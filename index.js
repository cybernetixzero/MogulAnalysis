/*
    MogulAnalysis by CybernetixZero
    This Node.js app uses Puppeteer to spin up a headless Chrome browser to sign into Mogul.gg and collect
    JSON responses across a range of tournaments and render them into a report.
*/

const puppeteer = require("puppeteer");
const fs = require("fs");
const { type } = require("os");

// Configuration
const email = "<Email>";
const password = "<Password>";
const tournamentIDStart = 45750;
const tournamentIDEnd = 45755;

// Globals
var gBrowser = null;
var gCookies = null;

run();

async function run() {
    gBrowser = await puppeteer.launch();

    // Check if a cookie exists, if so then use it otherwise authenticate and save cookie.
    if (!fs.existsSync(".\\cookies.json"))
        await performAuthAndSaveCookies();
    else
        await getCookies();
    
    // Grab the home and tournament JSON responses.
    let homeData = await getHomeData();
    let tournamentData = await getTournamentData();

    gBrowser.close();

    // Save the JSON responses for offline reference.
    dumpObject(".\\homeData.json", homeData);
    dumpObject(".\\tournamentData.json", tournamentData);

    // Generate a report using the JSON responses.
    generateReport(homeData, tournamentData);
}

async function performAuthAndSaveCookies() {
    // Start a new page, navigate to the sign in page and wait for it to finish loading.
    let page = await gBrowser.newPage();
    await page.goto("https://auth.mogul.gg/sign-in", { waitUntil: "networkidle0"});

    // Populate the email and password form elements in the DOM.
    await page.type("#signin__email-input-input", email);
    await page.type("#signin__password-input-input", password);

    // Invoke a click event on the sign in button element.
    await page.click(".signin__submit-button");

    // Wait for the postback to finish loading.
    await page.waitForNavigation({ waitUntil: "networkidle0" })

    // This assumes sign in was successful and saves the cookies to disk.
    gCookies = await page.cookies();
    let cookiesJson = JSON.stringify(gCookies, null, 2);
    fs.writeFileSync(".\\cookies.json", cookiesJson);
}

async function getCookies() {
    // Reads to the cookies from disk and parses the JSON into an object.
    let cookiesJson = fs.readFileSync(".\\cookies.json");
    gCookies = JSON.parse(cookiesJson);
}

async function getHomeData() {
    // Start a new page and apply the cookies.
    let page = await gBrowser.newPage();
    await page.setCookie(...gCookies);

    let homeData = {
        "Arena": null,
        "Init": null
    };

    // Subscribe to the 'response' event so we can react to any HTTP responses.
    page.on("response", async response => {
        // Ignore any HTTP responses that aren't OK.
        if (response.status() != 200)
            return;

        // Grab the URL of the response.
        const uri = response.url();
        let json = null;

        // Depending on the URL, grab the JSON response and apply it to the object.
        if (uri.startsWith("https://client.mogul.gg/API/Authenticate/Token/Arena"))
            homeData.Arena = await getJsonFromResponse(uri, response);
        else if (uri.startsWith("https://client.mogul.gg/API/Platform/Application/Initialization"))
            homeData.Init = await getJsonFromResponse(uri, response);
        // else if (uri.startsWith("https://client.mogul.gg/API/Player/My/Games"))
        //     homeData.Games = await getJsonFromResponse(uri, response);
    });

    // Navigate to the page and wait for it to finish loading.
    await page.goto("https://mogul.gg", { waitUntil: "networkidle0" });

    // Return the object with the captured JSON responses.
    return homeData;
}

async function getTournamentData() {
    let tournamentData = new Array();

    for (var id = tournamentIDStart; id <= tournamentIDEnd; id++) {
        // Start a new page and apply the cookies.
        let page = await gBrowser.newPage();
        await page.setCookie(...gCookies);

        let tournament = {
            "ID": id,
            "Initial": null,
            "Chats": new Array()
        };

        // Subscribe to the 'response' event so we can react to any HTTP responses.
        page.on("response", async response => {
            // Ignore any HTTP responses that aren't OK.
            if (response.status() != 200)
                return;

            // Grab the URL of the response.
            const uri = response.url();
            let json = null;

            // Depending on the URL, grab the JSON response and apply it to the object.
            if (uri.startsWith(`https://polling.mogul.gg/API/Tournament/${id}/Initial`)) {
                tournament.Initial = await getJsonFromResponse(uri, response);
            }
            else if (uri.startsWith(`https://client.mogul.gg/API/Chat/Room/tourn-${id}/Messages`)) {
                let chatJson = await getJsonFromResponse(uri, response);
                tournament.Chats.push(chatJson);
            }
        });

        // Navigate to the page and wait for it to finish loading.
        await page.goto(`https://mogul.gg/Tournaments/Details/${id}`, { waitUntil: "networkidle0" });

        tournamentData.push(tournament);
    }

    // Return the object with the captured JSON responses.
    return tournamentData;
}

function generateReport(homeData, tournamentData) {
    // Read the HTML template from disk.
    let html = fs.readFileSync(".\\template.html").toString();

    let apiVersion = homeData.Init.Response.ApiVersion;
    let interfaceVersion = homeData.Init.Response.InterfaceVersion;
    let administrators = homeData.Init.Response.PlatformAdministratorList;
    let games = homeData.Init.Response.GameList;

    // Populate the HTML body based on the JSON responses. (There is probably a nicer way to do this but it works =D)
    let body = "";

    body += "<h2>Platform</h2>";
    
    body += "<h3>Administrators</h3>";
    body += "<ul>";
    for (let i = 0; i < administrators.length; i++) {
        let administrator = administrators[i];
        body += `<li class=\"floated\">${administrator}</li>`;
    }
    body += "</ul>";
    body += "<br />";

    body += "<h3>Versioning</h3>";
    body += "<table><tr><th>API Release Date</th><th>API Version</th><th>Interface Release Date</th><th>Interface Version</th></tr>";
    body += `<tr><td>${apiVersion.ReleaseDate}</td><td>${apiVersion.Version}</td><td>${interfaceVersion.ReleaseDate}</td><td>${interfaceVersion.Version}</td></tr>`;
    body += "</table>";

    body += "<h3>Games</h3>";
    body += "<table><tr><th>ID</th><th>Steam AppID</th><th>Name</th><th>Publisher</th><th>Code</th><th>Added Date</th><th>Updated Date</th><th>Web</th><th>Validation Method</th><th>Large Image Uri</th><th>Small Image Uri</th><th>Background Image Uri</th></tr>";
    for (let i = 0; i < games.length; i++) {
        let game = games[i];
        body += `<tr><td>${game.GameTitleId}</td><td>${game.SteamApplicationId}</td><td>${game.GameName}</td><td>${game.GameDescription}</td><td>${game.GameShortCode}</td><td>${game.GameAddedDateTime}</td><td>${game.GameRevisedDateTime}</td><td><a href=\"${game.GameWebsite}\">${game.GameWebsite}</td><td>${game.GameTitleValidationMethodType}</td><td><a href=\"${game.GameImageLargeUrl}\">${game.GameImageLargeUrl}</td><td><a href=\"${game.GameImageSmallUrl}\">${game.GameImageSmallUrl}</td><td><a href=\"${game.GameBackgroundUrl}\">${game.GameBackgroundUrl}</td></tr>`;
    }
    body += "</table>";

    body += "<h2>Tournaments</h2>";
    
    for (let i = 0; i < tournamentData.length; i++) {
        let tournament = tournamentData[i];
        let doesExist = (tournament.Initial != null && tournament.Initial != undefined);

        if (doesExist) {
            let initial = tournament.Initial.Response;
            let chats = tournament.Chats;

            body += `<h3>${tournament.ID}: ${initial.TournamentTitle}</h3>`;

            body += "<div style=\"float: left; margin-right: 10px;\">";
            body += "<h4>Details</h4>";
            body += "<table><tr><th>Description</th><th>Value</th></tr>";
            body += `<tr><td>ID</td><td>${tournament.ID}</td></tr>`;
            body += `<tr><td>Title</td><td>${initial.TournamentTitle}</td></tr>`;
            body += `<tr><td>Description</td><td>${initial.TournamentDescription}</td></tr>`;
            body += `<tr><td>Game</td><td>${initial.Game.GameName}</td></tr>`;
            body += `<tr><td>Platforms</td><td>${initial.GamingPlatforms}</td></tr>`;
            body += `<tr><td>Owner</td><td>${initial.EntityOwnerProfile.DisplayName}</td></tr>`;
            body += `<tr><td>Start Date</td><td>${initial.TournamentStartDateTime}</td></tr>`;
            body += `<tr><td>End Date</td><td>${initial.TournamentEndDateTime}</td></tr>`;
            body += `<tr><td>Is Complete</td><td>${initial.TournamentIsComplete}</td></tr>`;
            body += `<tr><td>Rules Title</td><td>${initial.RulesTitle}</td></tr>`;
            body += `<tr><td>Rules Description</td><td>${initial.RulesDescription}</td></tr>`;
            body += `<tr><td>Current Participants</td><td>${initial.CurrentNumberOfParticipants}</td></tr>`;
            body += `<tr><td>Min / Max Participants</td><td>${initial.MinimumNumberOfEntities} / ${initial.MaximumNumberOfEntities}</td></tr>`;
            body += "</table>";
            body += "</div>";

            body += "<div style=\"float: left;\">";
            body += "<h4>Chat</h4>";
            body += "<table><tr><th>Date</th><th>User</th><th>Message</th></tr>";
            for (let x = 0; x < chats.length; x++) {
                let rows = chats[x].Response;
                for (let y = 0; y < rows.length; y++) {
                    let row = rows[y];
                    body += `<tr><td>${row.ChatMessageDateTime}</td><td>${row.DisplayName}</td><td>${row.ChatMessage}</td></tr>`;
                }
            }
            body += "</table>";
            body += "</div>";
            body += "<br />";
        }
        else {
            body += `<h3>${tournament.ID}: <span style=\"color: #FF0000;\">[Tournament doesn't exist]</span></h3>`;
        }
    }

    let dateNow = new Date();    
    html = html.replace("{Date}", `${dateNow.getDate()}/${dateNow.getMonth()}/${dateNow.getFullYear()} ${dateNow.getHours()}:${dateNow.getMinutes()}`);
    html = html.replace("{TournamentIDStart}", tournamentIDStart);
    html = html.replace("{TournamentIDEnd}", tournamentIDEnd);
    html = html.replace("{Body}", body);

    // Write the report to disk.
    fs.writeFileSync(`.\\report ${tournamentIDStart} - ${tournamentIDEnd}.html`, html);
}

async function getJsonFromResponse(uri, response) {
    let json = await response.json();

    if (json == null || !json.Success) {
        console.log(`${uri} [Failed to get the JSON]`);
        return null;
    } else {
        console.log(`${uri} [Successful]`);
        return json;
    }
}

function dumpObject(path, obj) {
    let json = JSON.stringify(obj);
    fs.writeFileSync(path, json);
}
