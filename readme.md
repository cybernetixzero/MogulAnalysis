# MogulAnalysis
*Written by CybernetixZero*

This app is used to collect data about the Mogul.gg web app. The generated reports assist with understanding progress of the platform.

## Prerequisites
You will need to install Node.js + npm.

## Installation
1. Unzip the archive containing the code into a folder (preferably ./MogulAnalysis).
2. Fire up your favourite terminal / command line.
3. Navigate to the folder.
4. Run `npm install`

## Configuration
The app requires credentials to Mogul.gg in order to sign in and access the JSON data.
Edit the `index.js` file and adjust the consts accordingly.

```js
{
// Configuration
const email = "<Email>";
const password = "<Password>";
const tournamentIDStart = 00000;
const tournamentIDEnd = 00000;
}
```

## Running
1. Fire up your favourite terminal / command line.
2. Navigate to the folder.
3. Run `node .`
