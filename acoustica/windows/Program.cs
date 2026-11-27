using System.Buffers.Binary;
using System.Diagnostics;
using System.Net.WebSockets;
using System.Text.Json;
using System.Threading.Channels;
using NAudio.CoreAudioApi;
using NAudio.Wave;

const string url = "http://127.0.0.1:8769";
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = AppContext.BaseDirectory, WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot") });
builder.WebHost.UseUrls(url);
var app = builder.Build();
app.Use(async (ctx, next) => {
    if (ctx.Request.Host.Value != "127.0.0.1:8769") { ctx.Response.StatusCode = 403; return; }
    ctx.Response.Headers["Cross-Origin-Resource-Policy"] = "same-origin";
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    await next();
});
app.UseWebSockets();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions {
    OnPrepareResponse = x => x.Context.Response.Headers["Cache-Control"] = "no-cache"
});
int active = 0;
app.Map("/audio", async (HttpContext ctx) => {
    if (!ctx.WebSockets.IsWebSocketRequest || ctx.Request.Headers.Origin.ToString() != url) { ctx.Response.StatusCode = 403; return; }
    if (Interlocked.Exchange(ref active, 1) != 0) { ctx.Response.StatusCode = 409; return; }
    try {
        using var socket = await ctx.WebSockets.AcceptWebSocketAsync();
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted);
        var cancel = cts.Token;
        var queue = Channel.CreateBounded<byte[]>(new BoundedChannelOptions(16) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true, SingleWriter = true });
        using var enumerator = new MMDeviceEnumerator();
        using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        using var capture = new WasapiLoopbackCapture(device);
        var fmt = capture.WaveFormat;
        var floatFormat = fmt.Encoding == WaveFormatEncoding.IeeeFloat || (fmt is WaveFormatExtensible ex && ex.SubFormat == new Guid("00000003-0000-0010-8000-00aa00389b71"));
        var pcmFormat = fmt.Encoding == WaveFormatEncoding.Pcm || (fmt is WaveFormatExtensible ep && ep.SubFormat == new Guid("00000001-0000-0010-8000-00aa00389b71"));
        var width = fmt.BitsPerSample / 8;
        if ((!floatFormat && !pcmFormat) || (floatFormat && width != 4) || (pcmFormat && width is not (2 or 3 or 4))) throw new NotSupportedException("Unsupported playback PCM format: " + fmt);
        int channels = Math.Min(fmt.Channels, 2);
        if (channels < 1) throw new NotSupportedException("Playback endpoint has no channels");
        long frame = 0;
        capture.DataAvailable += (_, e) => {
            int n = e.BytesRecorded / fmt.BlockAlign;
            if (n == 0) return;
            byte[] packet = new byte[16 + n * channels * 4];
            BinaryPrimitives.WriteInt32LittleEndian(packet.AsSpan(0), fmt.SampleRate);
            BinaryPrimitives.WriteInt32LittleEndian(packet.AsSpan(4), channels);
            BinaryPrimitives.WriteInt64LittleEndian(packet.AsSpan(8), frame);
            frame += n;
            for (int i=0;i<n;i++) for(int c=0;c<channels;c++) {
                int j=i*fmt.BlockAlign+c*width;
                float v = floatFormat ? BitConverter.ToSingle(e.Buffer,j) : width switch {
                    2 => BinaryPrimitives.ReadInt16LittleEndian(e.Buffer.AsSpan(j))/32768f,
                    3 => ((e.Buffer[j]|(e.Buffer[j+1]<<8)|(e.Buffer[j+2]<<16))<<8>>8)/8388608f,
                    4 => BinaryPrimitives.ReadInt32LittleEndian(e.Buffer.AsSpan(j))/2147483648f,
                    _ => 0
                };
                BinaryPrimitives.WriteSingleLittleEndian(packet.AsSpan(16+(i*channels+c)*4), float.IsFinite(v)?v:0);
            }
            queue.Writer.TryWrite(packet);
        };
        capture.RecordingStopped += (_,e) => queue.Writer.TryComplete(e.Exception);
        await socket.SendAsync(new ArraySegment<byte>(JsonSerializer.SerializeToUtf8Bytes(new { device = device.FriendlyName, sampleRate = fmt.SampleRate, channels })), WebSocketMessageType.Text,true,cancel);
        var receive = Task.Run(async () => { try { byte[] b=new byte[64]; while(!cancel.IsCancellationRequested) { var r=await socket.ReceiveAsync(new ArraySegment<byte>(b),cancel); if(r.MessageType==WebSocketMessageType.Close) break; } } catch {} finally { cts.Cancel(); } });
        try {
            capture.StartRecording();
            await foreach(var packet in queue.Reader.ReadAllAsync(cancel)) await socket.SendAsync(new ArraySegment<byte>(packet),WebSocketMessageType.Binary,true,cancel);
        } catch(OperationCanceledException) {} catch(Exception e) {
            if(socket.State==WebSocketState.Open) try { await socket.SendAsync(new ArraySegment<byte>(JsonSerializer.SerializeToUtf8Bytes(new {error=e.Message})),WebSocketMessageType.Text,true,CancellationToken.None); } catch {}
        } finally {
            cts.Cancel();
            try { capture.StopRecording(); } catch {}
            await receive;
        }
    } catch(Exception e) { Console.Error.WriteLine("Windows audio: "+e.Message); }
    finally { Interlocked.Exchange(ref active,0); }
});
app.Lifetime.ApplicationStarted.Register(() => {
    Console.WriteLine("ACOUSTICA local lab: "+url+"/ — close this window to stop the helper.");
    if (!args.Contains("--no-browser")) try { Process.Start(new ProcessStartInfo(url+"/") { UseShellExecute = true }); } catch {}
});
await app.RunAsync();
