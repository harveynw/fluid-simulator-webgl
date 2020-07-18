#version 300 es

precision highp float;

layout(location = $VELOCITY_TEXTURE) uniform sampler2D u_velocity;
layout(location = $LABEL_TEXTURE) uniform sampler2D u_label;

layout(location = $GRID_SIZE) uniform vec3 u_gridSize;
layout(location = $GRID_STEP_SIZE) uniform vec3 u_gridStepSize;
layout(location = $TEXTURE_SIZE) uniform float u_textureSize;
layout(location = $GRID_TEXTURE_SIZE) uniform float u_gridTextureSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;

vec3 fetchVelocity(vec3 position) {
	vec2 textureCoords = positionToTexturePadded(position, u_gridSize, u_gridTextureSize);
	return(texture(u_velocity, textureCoords).xyz);
}
 
void main() {
	if(texture(u_label, v_texture_coord).xyz == vec3(0,0,0)) discard;

	vec3 position = textureToPosition(v_texture_coord, u_gridSize, u_textureSize);

	vec3 velocityIn = fetchVelocity(position);

	float xOut = getVelocityAtCell(position + u_gridStepSize*vec3(1,0,0)).x;
	float yOut = getVelocityAtCell(position + u_gridStepSize*vec3(0,1,0)).y;
	float zOut = getVelocityAtCell(position + u_gridStepSize*vec3(0,0,1)).z;
	vec3 velocityOut = vec3(xOut, yOut, zOut);

	outColor = vec4(dot(velocityOut - velocityIn, vec3(1,1,1)), 0, 0, 1);
}