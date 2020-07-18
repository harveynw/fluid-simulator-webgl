#version 300 es

in int a_particle_index;

layout(location = $NO_PARTICLES) uniform float u_no_particles;
 
out float v_particle_index;
 
void main() {
	float particle_index = float(a_particle_index);

	float clipSpace = (particle_index + 0.5)/u_no_particles;
	
	gl_Position = vec4(clipSpace*2.0 - 1.0, 0.5, 0, 1);
	gl_PointSize = 1.0;

	v_particle_index = particle_index;
}