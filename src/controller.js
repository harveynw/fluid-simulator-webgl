class Controller {
	constructor(canvas) {
		this.mouseDown = false;
		this.mouseLast = [0,0];

		this.viewRotation = [0,0,0];

		this.recordMouse = this.recordMouse.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);

		canvas.addEventListener('mousedown', this.onMouseDown);
  		canvas.addEventListener('mouseup', this.onMouseUp);
  		canvas.addEventListener('mousemove', this.onMouseMove);
	}

	recordMouse(event) {
  		this.mouseLast = [event.clientX, event.clientY];
	}

	onMouseDown(event) {
  		this.mouseDown = true;
  		this.recordMouse(event);
	}

	onMouseUp(event) {
	  	this.mouseDown = false;
	  	this.recordMouse(event);
	}

	onMouseMove(event) {
	  	if(!this.mouseDown) return;

	  	let deltaX = event.clientX - this.mouseLast[0]; 
	  	let deltaY = event.clientY - this.mouseLast[1];

	  	this.viewRotation[2] = this.viewRotation[2] + deltaX*0.1;
	  	//viewRotation[0] = viewRotation[0] + deltaY*0.1;

	  	this.recordMouse(event);
	}
}

export default Controller;