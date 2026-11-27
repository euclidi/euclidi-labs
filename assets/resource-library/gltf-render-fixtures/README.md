# glTF render and importer fixtures

These 14 Khronos examples cover core geometry, external binary buffers, vertex color, skeletal animation, morph targets, channel interpolation, texture coordinates, samplers, metallic roughness and sidedness. [manifest.json](manifest.json) maps each feature to its model, source revision, checksums, external resources and license. Preserve each fixture's directory layout and attribution.

Run the schema and source-byte check from this folder with Node.js and the Khronos validator:

    npm install --prefix ./.validator gltf-validator@2.0.0-dev.3.10
    node validate.cjs ./.validator/node_modules/gltf-validator

You can also pass an existing validator module's full path. The upstream RiggedSimple fixture produces one skinned-mesh hierarchy warning. The script reports it with the structural error count. Load the fixtures in your renderer to evaluate visual output and sampler behavior.

[Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/e124e8d8d7330a5372bc2b4d00d39a4a9d7997ea)
