#version 300 es

in int a_particle_index;

layout(location = $PARTICLE_POSITION) uniform sampler2D u_particle_position;
layout(location = $MVP_MATRIX) uniform mat4 u_matrix;
 
void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;

	gl_Position = u_matrix * vec4(position - vec3(-0.5, -0.5, 0.0), 1.0);
  	gl_PointSize = 4.0;
}