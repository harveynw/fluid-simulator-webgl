#version 300 es
 
in int a_particle_index;

layout(location = $PARTICLE_POSITION) uniform sampler2D u_particle_position;
layout(location = $PARTICLE_VELOCITY) uniform sampler2D u_particle_velocity;

layout(location = $GRID_SIZE) uniform vec3 u_gridSize;
layout(location = $TEXTURE_SIZE) uniform float u_textureSize;

@import-util;

void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;

	gl_Position = vec4(positionToTexture(position, u_gridSize, u_textureSize), 0, 1);
	gl_PointSize = 1.0;
}