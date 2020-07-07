#version 300 es
 
precision highp float;

in vec3 v_velocity;
in vec3 v_weight;

layout(location = 0) out vec4 outVelocity;
layout(location = 1) out vec4 outWeight;

void main() {
	outVelocity = vec4(v_velocity, 1.0);
	outWeight = vec4(v_weight, 1.0);
}