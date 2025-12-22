const RevitCoordinatesToolToolName = 'revit-coordinates-tool';

class RevitCoordinatesTool extends Autodesk.Viewing.ToolInterface {
  constructor(viewer) {
    super();
    this.viewer = viewer;
    this.names = [RevitCoordinatesToolToolName];
    this.selection = [];
    this.active = false;
    this.surveyPointColorStyle = null;
    // Hack: delete functions defined on the *instance* of a ToolInterface (we want the tool controller to call our class methods instead)
    delete this.register;
    delete this.deregister;
    delete this.activate;
    delete this.deactivate;
    delete this.getPriority;
    delete this.handleSingleClick;
  }

  register() {
      console.log('RevitCoordinatesTool registered.');
  }

  deregister() {
      console.log('RevitCoordinatesTool unregistered.');
  }

  async prepareDataViz() {
    let DataVizCore = Autodesk.DataVisualization.Core;
    this.viewableData = new DataVizCore.ViewableData();
    this.viewableData.spriteSize = 32; // Sprites as points of size 24 x 24 pixels
    let viewableType = DataVizCore.ViewableType.SPRITE;
    let surveyPointColor = new THREE.Color(0xffffff);
    let surveyPointColorIconUrl = "https://img.icons8.com/ios-filled/50/address--v1.png";
    this.surveyPointColorStyle = new DataVizCore.ViewableStyle(viewableType, surveyPointColor, surveyPointColorIconUrl);
  }

    activate() {
    if (!this.active) {
        console.log('RevitCoordinatesTool activated.');
        this.active = true;
    }
  }

  async renderSurveyPoint() {
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
    let spritePoint = refPointLMV.clone().sub(globalOffsetPoint);
    let viewable = new DataVizCore.SpriteViewable(spritePoint, this.surveyPointColorStyle, 9999);
    this.viewableData.addViewable(viewable);

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
        this.tool.renderSurveyPoint();
      }
      else{
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
    const controller = this.viewer.toolController;
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