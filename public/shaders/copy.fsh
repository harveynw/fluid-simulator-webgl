#version 300 es

precision highp float;

uniform sampler2D u_velocity_updated;

in vec2 v_texture_coord;

out vec4 outColor;
 
void main() {
	outColor = vec4(texture(u_velocity_updated, v_texture_coord).rgb,1);
}