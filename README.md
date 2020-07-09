# fluid-simulator-webgl
An interactive fluid simulator written in WebGL

WORK - IN - PROGRESS

A javascript application designed to approximate incompressible fluid flow modelled by the Navier-stokes equations via the PIC/FLIP method.
Each form of state in the program, including the velocity grid and particle positions, are encoded in RGB textures and sequentially manipulated at each stage of the algorithm by shader programs.

Program is wrapped in the React framework for future UI controls.

### TODO
- Implement pseudo-pressure gradient solver and advection routines
- Display particle positions using instanced voxels
- Write abstraction layer for WebGL to clear up simulation code

### Installation and requirements 

1. Clone the repository
2. Install node >= 12.16.0 and npm
3. ```npm i``` followed by ```npm start```
4. Open localhost:3000 in a WebGL2 compatible browser

### Related work

Algorithm based on Robert Bridson's [Fluid Simulation for Computer Graphics](https://www.cs.ubc.ca/~rbridson/fluidsimulation/). These [notes](http://www.danenglesson.com/images/portfolio/FLIP/rapport.pdf) were also extremely useful as reference material.

Inspired by David Li's [work](https://github.com/dli/fluid)

