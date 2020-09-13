#version 300 es
 
in vec2 a_square_vertex;
 
out vec2 v_texture_coord;
 
void main() {
   gl_Position = vec4(a_square_vertex, 0, 1);
   v_texture_coord = (a_square_vertex + 1.0)/2.0;
}