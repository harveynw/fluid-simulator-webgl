#version 300 es
 
// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;

out vec4 outColor;
 
void main() {
	outColor = vec4(1.0, 1.0, 1.0, 1.0);
}