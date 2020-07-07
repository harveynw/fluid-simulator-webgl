#version 300 es

precision highp float;

uniform sampler2D u_texture;

in vec2 v_texture_coord;

out vec4 outColor;
 
void main() {
	outColor = vec4(texture(u_texture, v_texture_coord).rgb,1);
	//outColor = vec4(v_texture_coord.x,v_texture_coord.y,v_texture_coord.y*v_texture_coord.y,1);
}