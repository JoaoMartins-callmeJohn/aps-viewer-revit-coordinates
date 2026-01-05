const RevitCoordinates2DToolToolName = 'revit-coordinates-2d-tool';

class RevitCoordinates2DTool extends Autodesk.Viewing.ToolInterface {
  constructor(viewer) {
    super();
    this.viewer = viewer;
    this.names = [RevitCoordinates2DToolToolName];
    this.selection = [];
    this.active = false;
    this.coordinatesDiv = null;
    // Hack: delete functions defined on the *instance* of a ToolInterface (we want the tool controller to call our class methods instead)
    delete this.register;
    delete this.deregister;
    delete this.activate;
    delete this.deactivate;
    delete this.getPriority;
    delete this.handleSingleClick;
    delete this.handleMouseMove;
  }

  register() {
      console.log('RevitCoordinates2DTool registered.');
  }

  deregister() {
      console.log('RevitCoordinates2DTool unregistered.');
      // Clean up coordinates display div
      if (this.coordinatesDiv && this.coordinatesDiv.parentNode) {
        this.coordinatesDiv.parentNode.removeChild(this.coordinatesDiv);
        this.coordinatesDiv = null;
      }
  }

  handleMouseMove(event) {
    if (!this.active) {
      return false;
    }

    // Get the viewports extension
    const viewportExt = this.viewer.getExtension('Autodesk.AEC.ViewportsExtension');
    if (!viewportExt) {
      return false;
    }

    // For 2D views, convert canvas coordinates to sheet coordinates
    // Use clientToWorld which returns sheet coordinates for 2D models
    const castResult = this.viewer.clientToWorld(event.canvasX, event.canvasY);
    
    if (!castResult) {
      // Hide coordinates when not over geometry
      if (this.coordinatesDiv) {
        this.coordinatesDiv.style.display = 'none';
      }
      return false;
    }

    // For 2D views, castResult.intersectPoint should be in sheet coordinates
    let sheetPos;
    if (castResult.intersectPoint) {
      sheetPos = new THREE.Vector2(castResult.intersectPoint.x, castResult.intersectPoint.y);
    } else if (castResult.point) {
      // Sometimes the point is in a different property
      sheetPos = new THREE.Vector2(castResult.point.x, castResult.point.y);
    } else {
      // Hide coordinates when no point found
      if (this.coordinatesDiv) {
        this.coordinatesDiv.style.display = 'none';
      }
      return false;
    }
    
    // Find the viewport at this point
    const viewport = viewportExt.findViewportAtPoint(this.viewer.model, sheetPos);
    if (!viewport) {
      // Hide coordinates when not over a viewport
      if (this.coordinatesDiv) {
        this.coordinatesDiv.style.display = 'none';
      }
      return false;
    }

    // Update coordinates using the viewport
    this._update(sheetPos, viewport);
    return false;
  }

  _update(sheetPos, viewport) {
    if (!sheetPos || !viewport) {
      return;
    }

    try {
      // Get sheet unit scale
      const sheetUnitScale = this.viewer.model.getUnitScale();
      
      // Get the 2D to 3D transformation matrix from the viewport
      const matrix = viewport.get2DTo3DMatrix(sheetUnitScale);

      //Get the unit string
      const unitString = this.viewer.model.getUnitString();
      
      // Convert sheet coordinates to world coordinates (3D)
      // Use the Z component from the matrix (matrix.elements[14]) for the Z coordinate
      const worldPos = new THREE.Vector3(sheetPos.x, sheetPos.y, matrix.elements[14]).applyMatrix4(matrix);
      
      // Use world coordinates directly as internal Revit coordinates
      const internalRevitCoords = worldPos;
      
      // Ensure the coordinates div exists (should be created in activate, but double-check)
      if (!this.coordinatesDiv) {
        this.coordinatesDiv = document.createElement('div');
        this.coordinatesDiv.id = 'revit-coordinates-2d-display';
        this.coordinatesDiv.style.cssText = `
          position: absolute;
          top: 10px;
          left: 10px;
          background-color: rgba(0, 0, 0, 0.85);
          color: white;
          padding: 10px 15px;
          border-radius: 5px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          z-index: 10000;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          display: block;
          min-width: 200px;
        `;
        const viewerContainer = this.viewer.container;
        if (viewerContainer) {
          viewerContainer.appendChild(this.coordinatesDiv);
        }
      }
      
      // Make sure the div is visible
      this.coordinatesDiv.style.display = 'block';
      
      // Get viewport name if available
      let viewportName = 'Unknown';
      try {
        if (viewport.viewportRaw && viewport.viewportRaw.viewGuid) {
          viewportName = this._getViewPortName(viewport.viewportRaw.viewGuid);
        }
      } catch (error) {
        // Ignore errors getting viewport name
      }
      
      // Update the div content with coordinates
      this.coordinatesDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid rgba(255, 255, 255, 0.3); padding-bottom: 5px;">
          Internal Revit Coordinates (2D)
        </div>
        <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); margin-bottom: 5px;">
          Viewport: ${viewportName}
        </div>
        <div>X: ${internalRevitCoords.x.toFixed(3)} ${unitString}</div>
        <div>Y: ${internalRevitCoords.y.toFixed(3)} ${unitString}</div>
        <div>Z: ${internalRevitCoords.z.toFixed(3)} ${unitString}</div>
      `;
    } catch (error) {
      console.error('Error updating 2D coordinates:', error);
      // Hide coordinates on error
      if (this.coordinatesDiv) {
        this.coordinatesDiv.style.display = 'none';
      }
    }
  }

  _getViewPortName(viewGuid) {
    try {
      let viewName = null;
      const docNode = this.viewer.model.getDocumentNode();
      if (!docNode || !docNode.parent || !docNode.parent.parent) {
        return 'Unknown';
      }
      
      docNode.parent.parent.children.forEach(folder => {
        try {
          if (folder.data && folder.data.children) {
            folder.data.children.forEach(viewType => {
              if (viewType.children) {
                viewType.children.forEach(view => {
                  if (view.guid === viewGuid) {
                    viewName = view.name;
                  }
                });
              }
            });
          }
        } catch (error) {
          // In this case, the bubble doesn't contain children
        }
      });
      return viewName || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  activate() {
    if (!this.active) {
        console.log('RevitCoordinates2DTool activated.');
        this.active = true;
        // Create the coordinates div if it doesn't exist
        if (!this.coordinatesDiv) {
          this.coordinatesDiv = document.createElement('div');
          this.coordinatesDiv.id = 'revit-coordinates-2d-display';
          this.coordinatesDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            display: block;
            min-width: 200px;
          `;
          const viewerContainer = this.viewer.container;
          if (viewerContainer) {
            viewerContainer.appendChild(this.coordinatesDiv);
          }
        }
        // Show coordinates display when tool is activated
        this.coordinatesDiv.style.display = 'block';
    }
  }

  deactivate() {
    if (this.active) {
        this.active = false;
    }
    // Hide coordinates display when tool is deactivated
    if (this.coordinatesDiv) {
      this.coordinatesDiv.style.display = 'none';
    }
  }

  getPriority() {
      return 99; // Feel free to use any number higher than 0 (which is the priority of all the default viewer tools)
  }

  handleSingleClick(event, button) {
      const currentSelection = this.viewer.getSelection();
      //check if ctrl key is pressed
      if (event.ctrlKey) {
        this.selection.push(...currentSelection)
      }
      else{
        const castResult = this.viewer.clientToWorld(event.canvasX, event.canvasY);
        this.selection = !!castResult?.dbId? [castResult.dbId]: []; // Reset the selection if ctrl key is not pressed
      }
      this.viewer.select(this.selection); 
      //Return true so it doesn't call the default behavior of the viewer (which is to select the object under the mouse cursor)
      return true;
  }
}

class RevitCoordinates2DExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._button = null;
    this.tool = new RevitCoordinates2DTool(viewer);
  }

  onToolbarCreated(toolbar) {
    this._button = this.createToolbarButton('revit-coordinates-2d-button', 'https://img.icons8.com/ios/50/coordinate-system.png', 'Show 2D Revit Coordinates');
    this._button.onClick = async () => {
      const currentState = this._button.getState();
      const newState = currentState === Autodesk.Viewing.UI.Button.State.ACTIVE 
        ? Autodesk.Viewing.UI.Button.State.INACTIVE 
        : Autodesk.Viewing.UI.Button.State.ACTIVE;
      
      this._button.setState(newState);
      
      if(newState === Autodesk.Viewing.UI.Button.State.ACTIVE){
        this.viewer.toolController.activateTool(RevitCoordinates2DToolToolName);
      }
      else{
        this.viewer.toolController.deactivateTool(RevitCoordinates2DToolToolName);
        this.tool.deactivate();
      }
    };
  }

  createToolbarButton(buttonId, buttonIconUrl, buttonTooltip) {
    let group = this.viewer.toolbar.getControl('coordinates-2d-toolbar-group');
    if (!group) {
      group = new Autodesk.Viewing.UI.ControlGroup('coordinates-2d-toolbar-group');
      this.viewer.toolbar.addControl(group);
    }
    const button = new Autodesk.Viewing.UI.Button(buttonId);
    button.setToolTip(buttonTooltip);
    group.addControl(button);
    const icon = button.container.querySelector('.adsk-button-icon');
    if (icon) {
      icon.style.backgroundImage = `url(${buttonIconUrl})`;
      icon.style.backgroundSize = `24px`;
      icon.style.backgroundRepeat = `no-repeat`;
      icon.style.backgroundPosition = `center`;
    }
    return button;
  }

  removeToolbarButton(button) {
    const group = this.viewer.toolbar.getControl('coordinates-2d-toolbar-group');
    group.removeControl(button);
  }

  async load() {
    // Load the ViewportsExtension which is needed for 2D viewport detection
    await this.viewer.loadExtension('Autodesk.AEC.ViewportsExtension');
    this.viewer.toolController.registerTool(this.tool);
    return true;
  }

  unload() {
    const controller = this.viewer.toolController;
    controller.deactivateTool(RevitCoordinates2DToolToolName);
    if (this._button) {
        this.removeToolbarButton(this._button);
        this._button = null;
    }
    return true;
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension('RevitCoordinates2DExtension', RevitCoordinates2DExtension);

