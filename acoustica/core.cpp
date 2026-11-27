// ACOUSTICA experimental reference DSP. Freestanding C++20, no libc.
extern "C" {
__attribute__((import_module("math"),import_name("sin"))) double sine(double);
__attribute__((import_module("math"),import_name("cos"))) double cosine(double);
__attribute__((import_module("math"),import_name("sqrt"))) double root(double);
}
constexpr int MAX=65536;
static double in[MAX],re[MAX],im[MAX],out[MAX],diff[MAX],stats[8];
constexpr double pi=3.14159265358979323846;
extern "C" {
 double* input(){return in;} double* output(){return out;} double* metrics(){return stats;}
 void analyze(int n,int win){
  if(n<2||n>MAX||(n&(n-1)))return;
  double sum=0,peak=0,energy=0,mean=0,ws=0,ws2=0;
  for(int i=0;i<n;i++){double v=in[i];mean+=v;energy+=v*v;double a=v<0?-v:v;if(a>peak)peak=a;}
  for(int i=0,j=0;i<n;i++){
   double z=2*pi*i/(n-1),w=1;
   if(win==1)w=.5-.5*cosine(z);else if(win==2)w=.54-.46*cosine(z);else if(win==3)w=.35875-.48829*cosine(z)+.14128*cosine(2*z)-.01168*cosine(3*z);else if(win==4)w=.21557895-.41663158*cosine(z)+.277263158*cosine(2*z)-.083578947*cosine(3*z)+.006947368*cosine(4*z);
   ws+=w;ws2+=w*w; re[j]=in[i]*w;im[j]=0;
   int k=n>>1;while(k&&(j&k)){j^=k;k>>=1;}j^=k;
  }
  for(int m=2;m<=n;m*=2){double a=-2*pi/m,wr=cosine(a),wi=sine(a);for(int i=0;i<n;i+=m){double x=1,y=0;for(int j=0;j<m/2;j++){int p=i+j,q=p+m/2;double r=re[q]*x-im[q]*y,t=re[q]*y+im[q]*x;re[q]=re[p]-r;im[q]=im[p]-t;re[p]+=r;im[p]+=t;double u=x*wr-y*wi;y=x*wi+y*wr;x=u;}}}
  for(int i=0;i<=n/2;i++){double s=re[i]*re[i]+im[i]*im[i];sum+=s*((i==0||i==n/2)?1:2);out[i]=root(s)/ws*((i==0||i==n/2)?1:2);}
  stats[0]=root(energy/n);stats[1]=peak;stats[2]=mean/n;stats[3]=sum/n;stats[4]=ws2;stats[5]=ws;stats[6]=0;for(int i=0;i<n;i++)if(in[i]>=.999||in[i]<=-.999)stats[6]++;
 }
 // YIN cumulative mean normalized difference; threshold and parabolic interpolation.
 double pitch(int n,double fs,double minf,double maxf){
  int lo=(int)(fs/maxf),hi=(int)(fs/minf);if(lo<2)lo=2;if(hi>n/2-2)hi=n/2-2;if(hi<=lo)return 0;
  int span=n-hi-1;if(span>2048)span=2048;double energy=0,mean=0;for(int i=0;i<span;i++){energy+=in[i]*in[i];mean+=in[i];}if(energy/span-mean*mean/(span*span)<1e-8){stats[7]=0;return 0;}
  double run=0;diff[0]=1;
  for(int t=1;t<=hi+1;t++){double d=0;for(int j=0;j<span;j++){double v=in[j]-in[j+t];d+=v*v;}run+=d;diff[t]=run>0?d*t/run:1;}
  int t=lo;while(t<=hi&&diff[t]>.15)t++;if(t>hi){stats[7]=0;return 0;}while(t<hi&&diff[t+1]<diff[t])t++;double a=diff[t-1],b=diff[t],c=diff[t+1],den=a-2*b+c;double shift=den!=0?.5*(a-c)/den:0;stats[7]=1-b;return fs/(t+shift);
 }
}
// Staggered-grid first-order pressure/particle-velocity FDTD, limited reference 2D geometry.
constexpr int FW=160,FH=100,FS=FW*FH;
static double fp[FS],fu[(FW+1)*FH],fv[FW*(FH+1)],fd[FS],fk[FS],loss[FS];static unsigned char solid[FS];static double fdx,fdt;static int fboundary;
static int cell(int x,int y){return y*FW+x;}
extern "C" {
 void field_init(double dx,int barrier,int absorb,int boundary,int water){fdx=dx;fboundary=boundary;double cmax=water?1480:343;fdt=.85*dx/(1.4142135623730951*cmax);for(int y=0;y<FH;y++)for(int x=0;x<FW;x++){int i=cell(x,y);double rho=(water&&x>105)?998:1.204,c=(water&&x>105)?1480:343;fd[i]=rho;fk[i]=rho*c*c;fp[i]=0;solid[i]=barrier&&x==85&&(y<40||y>60);int edge=x;if(y<edge)edge=y;if(FW-1-x<edge)edge=FW-1-x;if(FH-1-y<edge)edge=FH-1-y;double z=absorb&&edge<12?(12-edge)/12.:0;loss[i]=1-.08*z*z;}
 for(int i=0;i<(FW+1)*FH;i++)fu[i]=0;for(int i=0;i<FW*(FH+1);i++)fv[i]=0;}
 double field_dt(){return fdt;}double* field_p(){return fp;}double* field_u(){return fu;}double* field_v(){return fv;}
 void field_step(double drive,int sx,int sy){double a=fdt/fdx;for(int y=0;y<FH;y++)for(int x=0;x<=FW;x++){int j=y*(FW+1)+x;if(x==0||x==FW){int c=cell(x==0?0:FW-1,y);fu[j]=(fboundary||solid[c])?0:(fu[j]-a*(x==0?2:-2)*fp[c]/fd[c])*loss[c];continue;}int l=cell(x-1,y),r=cell(x,y);fu[j]=(solid[l]||solid[r])?0:(fu[j]-2*a*(fp[r]-fp[l])/(fd[l]+fd[r]))*(loss[l]+loss[r])*.5;}
 for(int y=0;y<=FH;y++)for(int x=0;x<FW;x++){int j=y*FW+x;if(y==0||y==FH){int c=cell(x,y==0?0:FH-1);fv[j]=(fboundary||solid[c])?0:(fv[j]-a*(y==0?2:-2)*fp[c]/fd[c])*loss[c];continue;}int l=cell(x,y-1),r=cell(x,y);fv[j]=(solid[l]||solid[r])?0:(fv[j]-2*a*(fp[r]-fp[l])/(fd[l]+fd[r]))*(loss[l]+loss[r])*.5;}
 for(int y=0;y<FH;y++)for(int x=0;x<FW;x++){int i=cell(x,y),j=y*(FW+1)+x;fp[i]=solid[i]?0:(fp[i]-fk[i]*a*(fu[j+1]-fu[j]+fv[i+FW]-fv[i]))*loss[i];}if(sx>=0&&sx<FW&&sy>=0&&sy<FH&&!solid[cell(sx,sy)])fp[cell(sx,sy)]+=drive*fdt;}
}
