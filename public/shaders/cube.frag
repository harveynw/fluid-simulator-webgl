#version 300 es
 
// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;

in vec4 v_color;

out vec4 outColor;
 
void main() {
  outColor = v_color;
}