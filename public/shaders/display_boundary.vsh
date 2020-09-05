#version 300 es

in vec3 a_cube_vertex;

uniform mat4 u_mvp_matrix;
 
void main() {
	gl_Position = u_mvp_matrix * vec4(a_cube_vertex - vec3(0.5, 0.5, 0.5), 1.0);
}