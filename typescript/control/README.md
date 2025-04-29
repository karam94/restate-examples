# Control System Implementation

This project implements a control system for managing device states and workflows, particularly focused on charging and power management scenarios.

## Components

### Objects
* **[Device Object](src/objects/device_object.ts):** Manages device state and handles power control events. Supports IDLE, IMPORT, and EXPORT states.

### Workflows
* **[Import Workflow](src/workflows/import_workflow.ts):** Handles the charging workflow for devices, including validation and automatic transition to idle state.
* **[Idle Workflow](src/workflows/idle_workflow.ts):** Manages the idle state of devices.

### Types
* **[Types](src/types.ts):** Contains all type definitions for events, states, and control types.

## Running the Services

1. Make sure you have installed the dependencies: `npm install`

2. Start Restate Server in a separate shell: `npx restate-server`

3. Start the services:
   - Device Object Service: `npm run start-device` (runs on port 9081)
   - Import Workflow Service: `npm run start-import` (runs on port 9080)
   - Idle Workflow Service: `npm run start-idle` (runs on port 9082)

4. Register the services at Restate server by calling:
   `npx restate -y deployment register --force "localhost:9080"`

## API Examples

See the README files in the respective directories for detailed API examples:
- [Objects API Examples](src/objects/README.md)
- [Workflows API Examples](src/workflows/README.md)

**NOTE:** When you get an error of the type `{"code":"not_found","message":"Service not found..."}`, then you forgot to register the service (step 4 above).
