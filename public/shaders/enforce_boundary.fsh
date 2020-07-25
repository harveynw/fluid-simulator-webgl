#version 300 es

precision highp float;

uniform sampler2D u_velocity_forces;
uniform float u_gridTextureSize;
uniform vec3 u_gridStepSize;
uniform vec3 u_gridSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;
 
void main() {
	vec3 velocity = texture(u_velocity_forces, v_texture_coord).xyz;
	vec3 position = textureToPositionPadded(v_texture_coord, u_gridSize, u_gridTextureSize);

	// Correct velocity if boundary cell
	if(position.x < u_gridStepSize.x || position.x > 0.99999) {
		velocity = vec3(100000, velocity.y, velocity.z);
	}
	if(position.y < u_gridStepSize.y || position.y > 0.99999) {
		velocity = vec3(velocity.x, 100000, velocity.z);
	}
	if(position.z < u_gridStepSize.z|| position.z > 0.99999) {
		velocity = vec3(velocity.x, velocity.y, 100000);
	}

	outColor = vec4(velocity,1);
}