#version 300 es

precision highp float;

uniform sampler2D u_texture;
uniform int u_textureSize;
uniform ivec3 u_gridSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;
 
void main() {
	vec3 velocity = texture(u_texture, v_texture_coord).xyz;
	ivec3 cellCoordinate = textureCoordsToIndices(v_texture_coord, u_gridSize + 1, u_textureSize);

	// Correct velocity if boundary cell
	if(cellCoordinate.x == 0 || cellCoordinate.x == u_gridSize.x) {
		velocity = vec3(0, velocity.y, velocity.z);
	}
	if(cellCoordinate.y == 0 || cellCoordinate.y == u_gridSize.y) {
		velocity = vec3(velocity.x, 0, velocity.z);
	}
	if(cellCoordinate.z == 0 || cellCoordinate.z == u_gridSize.z) {
		velocity = vec3(velocity.x, velocity.y, 0);
	}

	outColor = vec4(velocity,1);
}