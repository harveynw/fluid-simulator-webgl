#version 300 es

precision highp float;

layout(location = $GENERIC_TEXTURE) uniform sampler2D u_texture;

layout(location = $DT) uniform float u_dt;
layout(location = $FORCE) uniform vec3 u_force;

in vec2 v_texture_coord;

out vec4 outColor;
 
void main() {
	outColor = vec4(texture(u_texture, v_texture_coord).rgb + u_force*u_dt,1);
}