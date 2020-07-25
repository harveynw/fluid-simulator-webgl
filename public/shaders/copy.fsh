#version 300 es

precision highp float;

uniform sampler2D u_velocity_boundary;

in vec2 v_texture_coord;

out vec4 outColor;
 
void main() {
	outColor = vec4(texture(u_velocity_boundary, v_texture_coord).rgb,1);
	//outColor = vec4(v_texture_coord.x,v_texture_coord.y,v_texture_coord.y*v_texture_coord.y,1);
}