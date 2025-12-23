const RevitCoordinatesToolToolName = 'revit-coordinates-tool';

class RevitCoordinatesTool extends Autodesk.Viewing.ToolInterface {
  constructor(viewer) {
    super();
    this.viewer = viewer;
    this.names = [RevitCoordinatesToolToolName];
    this.selection = [];
    this.active = false;
    this.surveyPointColorStyle = null;
    this.points = [];
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
      this.snapper = new Autodesk.Viewing.Extensions.Snapping.Snapper(this.viewer, { renderSnappedGeometry: false, renderSnappedTopology: false });
      this.viewer.toolController.registerTool(this.snapper);
      this.viewer.toolController.activateTool(this.snapper.getName());
      console.log('RevitCoordinatesTool registered.');
  }

  deregister() {
      console.log('RevitCoordinatesTool unregistered.');
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

    this.snapper.indicator.clearOverlays();
    if (this.snapper.isSnapped()) {
      this.viewer.clearSelection();
      const result = this.snapper.getSnapResult();
      const { SnapType } = Autodesk.Viewing.MeasureCommon;
      this.snapper.indicator.render(); // Show indicator when snapped to a vertex
      // Always update coordinates when snapped
      if (result && result.intersectPoint) {
        this._update(result.intersectPoint);
      }
    } else {
      // Hide coordinates when not snapped
      if (this.coordinatesDiv) {
        this.coordinatesDiv.style.display = 'none';
      }
    }
    return false;
  }

  _update(intersectPoint) {
    if (!intersectPoint) {
      return;
    }

    // Get global offset to convert viewer coordinates to internal Revit coordinates
    const globalOffset = this.viewer.model.getGlobalOffset();
    const globalOffsetPoint = new THREE.Vector3(globalOffset.x, globalOffset.y, globalOffset.z);
    
    // Convert viewer coordinates to internal Revit coordinates
    // Internal Revit coordinates = Viewer coordinates + globalOffset
    const internalRevitCoords = intersectPoint.clone().add(globalOffsetPoint);
    
    // Create or update the coordinates display div
    if (!this.coordinatesDiv) {
      this.coordinatesDiv = document.createElement('div');
      this.coordinatesDiv.id = 'revit-coordinates-display';
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
    
    // Update the div content with coordinates
    this.coordinatesDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid rgba(255, 255, 255, 0.3); padding-bottom: 5px;">
        Internal Revit Coordinates
      </div>
      <div>X: ${internalRevitCoords.x.toFixed(3)}</div>
      <div>Y: ${internalRevitCoords.y.toFixed(3)}</div>
      <div>Z: ${internalRevitCoords.z.toFixed(3)}</div>
    `;
  }

  async prepareDataViz() {
    let DataVizCore = Autodesk.DataVisualization.Core;
    this.viewableData = new DataVizCore.ViewableData();
    this.viewableData.spriteSize = 32; // Sprites as points of size 24 x 24 pixels
    let viewableType = DataVizCore.ViewableType.SPRITE;
    let surveyPointColor = new THREE.Color(0xffffff);
    let surveyPointColorIconUrl = "https://img.icons8.com/ios-filled/50/address--v1.png";
    this.surveyPointColorStyle = new DataVizCore.ViewableStyle(viewableType, surveyPointColor, surveyPointColorIconUrl);
    let internalOriginPointColor = new THREE.Color(0xffffff);
    let internalOriginPointColorIconUrl = "https://img.icons8.com/material-two-tone/24/coordinate-system.png";
    this.internalOriginPointColorStyle = new DataVizCore.ViewableStyle(viewableType, internalOriginPointColor, internalOriginPointColorIconUrl);
  }

    activate() {
    if (!this.active) {
        console.log('RevitCoordinatesTool activated.');
        this.active = true;
        // Show coordinates display when tool is activated
        if (this.coordinatesDiv) {
          this.coordinatesDiv.style.display = 'block';
        }
    }
  }

  async renderSurveyAndInternalOriginPoints() {
    let dataVizExtn = this.viewer.getExtension("Autodesk.DataVisualization");
    let DataVizCore = Autodesk.DataVisualization.Core;
    dataVizExtn.removeAllViewables();
    this.viewableData = new DataVizCore.ViewableData();
    this.viewableData.spriteSize = 32;

    //find survey point in Viewer Coordinates
    let surveyPointArray = this.viewer.model.getData().metadata.georeference.refPointLMV;
    let refPointLMV = new THREE.Vector3(surveyPointArray[0], surveyPointArray[1], surveyPointArray[2]);
    let globalOffset = this.viewer.model.getGlobalOffset();
    let globalOffsetPoint = new THREE.Vector3(globalOffset.x, globalOffset.y, globalOffset.z);
    let surveySpritePoint = refPointLMV.clone().sub(globalOffsetPoint);
    let surveyViewable = new DataVizCore.SpriteViewable(surveySpritePoint, this.surveyPointColorStyle, 99998);
    this.viewableData.addViewable(surveyViewable);

    //find internal origin point in Viewer Coordinates
    let internalOriginSpritePoint = globalOffsetPoint.clone().multiplyScalar(-1);
    let internalOriginViewable = new DataVizCore.SpriteViewable(internalOriginSpritePoint, this.internalOriginPointColorStyle, 99999);
    this.viewableData.addViewable(internalOriginViewable);

    this.viewableData.finish().then(() => {
        dataVizExtn.addViewables(this.viewableData);
    });
  }

  deactivate() {
    let dataVizExtn = this.viewer.getExtension("Autodesk.DataVisualization");
    dataVizExtn.removeAllViewables();
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

class RevitCoordinatesExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._button = null;
    this.tool = new RevitCoordinatesTool(viewer);
    this._onObjectTreeCreated = (ev) => this.onModelLoaded(ev.model);
  }

  async onModelLoaded(model) {
    await this.tool.prepareDataViz();
  }

  onToolbarCreated(toolbar) {
    this._button = this.createToolbarButton('text-props-button', 'https://img.icons8.com/ios/50/coordinate-system.png', 'Selected Element Text');
    this._button.onClick = async () => {
      this._button.setState(!!this._button.getState() ? Autodesk.Viewing.UI.Button.State.ACTIVE : Autodesk.Viewing.UI.Button.State.INACTIVE);
      if(this._button.getState() === Autodesk.Viewing.UI.Button.State.ACTIVE){
        this.viewer.toolController.activateTool(RevitCoordinatesToolToolName);
        this.tool.renderSurveyAndInternalOriginPoints();
      }
      else{
        this.viewer.toolController.deactivateTool(RevitCoordinatesToolToolName);
        this.tool.deactivate();
      }
    };
  }

  createToolbarButton(buttonId, buttonIconUrl, buttonTooltip) {
    let group = this.viewer.toolbar.getControl('coordinates-toolbar-group');
    if (!group) {
      group = new Autodesk.Viewing.UI.ControlGroup('coordinates-toolbar-group');
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
    const group = this.viewer.toolbar.getControl('coordinates-toolbar-group');
    group.removeControl(button);
  }

  async load() {
    await this.viewer.loadExtension('Autodesk.Snapping');
    this.viewer.toolController.registerTool(this.tool);
    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, this._onObjectTreeCreated);
    return true;
  }

  unload() {
    const controller = this.viewer.toolController;
    controller.deactivateTool(RevitCoordinatesToolToolName);
    if (this._button) {
        this.removeToolbarButton(this._button);
        this._button = null;
    }
    return true;
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension('RevitCoordinatesExtension', RevitCoordinatesExtension);