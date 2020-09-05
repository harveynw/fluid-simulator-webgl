#version 300 es

precision highp float;

uniform sampler2D u_particle_position;

in vec2 v_texture_coord;

out vec4 outColor;
 
void main() {
	outColor = vec4(texture(u_particle_position, v_texture_coord).rgb,1);
}