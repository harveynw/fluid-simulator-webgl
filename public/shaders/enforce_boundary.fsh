#version 300 es

precision highp float;

uniform sampler2D u_velocity_forces;
uniform float u_gridTextureSize;
uniform vec3 u_gridSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;
 
void main() {
	vec3 velocity = texture(u_velocity_forces, v_texture_coord).xyz;
	vec3 position = textureToPositionPadded(v_texture_coord, u_gridSize, u_gridTextureSize);

	// Correct velocity if boundary cell
	if(position.x == 0.0 || position.x == 1.0) {
		velocity = vec3(0, velocity.y, velocity.z);
	}
	if(position.y == 0.0 || position.y == 1.0) {
		velocity = vec3(velocity.x, 0, velocity.z);
	}
	if(position.z == 0.0 || position.z == 1.0) {
		velocity = vec3(velocity.x, velocity.y, 0);
	}

	outColor = vec4(velocity,1);
}