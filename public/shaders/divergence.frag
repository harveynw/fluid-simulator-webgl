#version 300 es

precision highp float;

uniform sampler2D u_velocity_boundary;
uniform sampler2D u_label;

uniform vec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform float u_textureSize;
uniform float u_gridTextureSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;

vec3 fetchVelocity(vec3 position) {
	vec2 textureCoords = positionToTexturePadded(position, u_gridSize, u_gridTextureSize);
	return(texture(u_velocity_boundary, textureCoords).xyz);
}
 
void main() {
	if(texture(u_label, v_texture_coord).xyz == vec3(0,0,0)) discard;

	vec3 position = textureToPosition(v_texture_coord, u_gridSize, u_textureSize);

	vec3 velocityIn = fetchVelocity(position);

	float xOut = fetchVelocity(position + u_gridStepSize*vec3(1,0,0)).x;
	float yOut = fetchVelocity(position + u_gridStepSize*vec3(0,1,0)).y;
	float zOut = fetchVelocity(position + u_gridStepSize*vec3(0,0,1)).z;
	vec3 velocityOut = vec3(xOut, yOut, zOut);

	outColor = vec4(dot(velocityOut - velocityIn, vec3(1,1,1)), 0, 0, 1);
}