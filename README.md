# APS Viewer Revit Coordinates

A simple web application demonstrating how to display internal Revit coordinates in the Autodesk Platform Services (APS) Viewer for both 3D and 2D views.

## Overview

This application provides two viewer extensions that display real-time internal Revit coordinate information:

1. **RevitCoordinates3DExtension** - Displays coordinates for 3D views using snapping functionality
2. **RevitCoordinates2DExtension** - Displays coordinates for 2D sheet views with viewport support

Each extension automatically detects the view type and activates accordingly, showing coordinates in a floating overlay as you move your mouse over geometry.

## Extensions Explained

### RevitCoordinates3DExtension

* Uses the APS Viewer Snapping extension to detect geometry intersections
* Converts viewer coordinates to internal Revit coordinates using the global offset
* Displays X, Y, Z coordinates in a floating overlay
* Best for: 3D models, spatial coordinate visualization
* Requirements: `Autodesk.Snapping` extension

### RevitCoordinates2DExtension

* Uses the APS Viewer ViewportsExtension to detect viewports in 2D sheets
* Converts sheet coordinates to world coordinates using viewport transformation matrices
* Displays X, Y, Z coordinates along with the viewport name
* Best for: 2D sheet views, plan views, detail views
* Requirements: `Autodesk.AEC.ViewportsExtension` extension

## Project Structure

```
├── index.html                      # Main HTML page with viewer initialization
├── RevitCoordinates3DExtension.js # 3D view coordinate extension
├── RevitCoordinates2DExtension.js # 2D view coordinate extension
├── LICENSE                         # MIT License
└── README.md                       # This file
```

## How It Works

### 3D Views

1. When activated, the extension registers a custom tool that uses the Snapping extension
2. As you move your mouse, it detects snapped geometry intersections
3. The intersection point (in viewer coordinates) is converted to internal Revit coordinates by adding the global offset
4. Coordinates are displayed in real-time in the top-left corner

### 2D Views

1. When activated, the extension uses the ViewportsExtension to find viewports
2. As you move your mouse, it converts canvas coordinates to sheet coordinates
3. It finds the viewport at that position and uses its transformation matrix
4. Sheet coordinates are converted to world coordinates using the viewport's 2D-to-3D matrix
5. Coordinates are displayed along with the viewport name

## License

This sample is licensed under the terms of the MIT License.

## Support

Please contact us via [APS Support](https://aps.autodesk.com/support).

## About

Sample to demonstrate displaying internal Revit coordinates in the APS Viewer for both 3D and 2D views.