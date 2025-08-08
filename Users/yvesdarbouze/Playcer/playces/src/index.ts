/**
 * This is a placeholder file for the 'playces' codebase.
 * Add your functions here.
 */

import * as functions from "firebase-functions";

export const helloPlayces = functions.https.onRequest((request, response) => {
  response.send("Hello from the playces codebase!");
});
