#version 300 es
 
in int a_particle_index;

uniform sampler2D u_particle_position;
uniform sampler2D u_particle_velocity;

uniform ivec3 u_gridSize;
uniform int u_textureSize;

@import-util;

void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;

	ivec3 indices = positionToIndices(position, u_gridSize);

	gl_Position = vec4(indicesToClipSpace(indices, u_gridSize, u_textureSize), 0, 1);
	gl_PointSize = 1.0;
}