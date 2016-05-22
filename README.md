# CorsCode Dynamic API Command-line Interface

That sounds like a mouthful, but this tool is extremely useful for creating simple APIs that utilize token authentication.

#### Requirements:
- NPM
- Node
- MongoDB database __WITH__ link
- __ABLE TO FOLLOW PROMPTS__

#### Usage:
- Install:
```
npm install -g corscode-dynamic-api
```
- Run in folder of new project:
```
corscode-init
```
- Follow steps, wait for script to finish, and enjoy a pre-built API!

## Update Log
- v0.1.0
    - Initial release
- v0.1.1
    - Fixed minor bug that prevented dependencies from installing properly
- v0.2.0
    - Interface updated for easier use
- v1.0.0
	- Updated the entire router to utilize Promises
	- Removed previous authentication due to faults
	- Now utilizing token authentication
	- Enhanced useability
	- Cleaner code, more user friendly
- v1.0.1
	- Fixed some minor restrictive bugs in crudFunctions
	- Added comparePassword method to authentication model
	- Re-organized middleware setup
- v1.1.0
	- Removed model creation from CLI
	- Added updater to routing system that replaces above removed
- v1.1.1
	- Fixed basic load error in crudFunctions (removed populate)
