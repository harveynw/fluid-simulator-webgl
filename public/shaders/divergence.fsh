#version 300 es

precision highp float;

uniform sampler2D u_velocity;
uniform sampler2D u_label;

uniform ivec3 u_gridSize;
uniform int u_textureSize;
uniform int u_gridTextureSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;

vec3 getVelocityAtCell(ivec3 indices) {
	// If requested outside grid
	if(any(greaterThanEqual(indices,u_gridSize)) || any(lessThan(indices,ivec3(0,0,0)))) {
		return(vec3(0,0,0));
	}
	ivec2 texels = indicesToTexels(indices, u_gridSize + 1, u_gridTextureSize);
	return(texelFetch(u_velocity, texels, 0).xyz);
}
 
void main() {
	if(texture(u_label, v_texture_coord).xyz == vec3(0,0,0)) discard;

	ivec3 cellCoordinate = textureCoordsToIndices(v_texture_coord, u_gridSize, u_textureSize);

	vec3 velocityIn = getVelocityAtCell(cellCoordinate);

	float xOut = getVelocityAtCell(cellCoordinate + ivec3(1,0,0)).x;
	float yOut = getVelocityAtCell(cellCoordinate + ivec3(0,1,0)).y;
	float zOut = getVelocityAtCell(cellCoordinate + ivec3(0,0,1)).z;
	vec3 velocityOut = vec3(xOut, yOut, zOut);

	// TODO render to a texture with just one channel as that's all we need
	outColor = vec4(dot(velocityOut - velocityIn, vec3(1,1,1)), 0, 0, 1);
}