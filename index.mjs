import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config();

const input = readFileSync(
  resolve(process.env.INPUT || "input.txt")
).toString();
const outputDir = process.env.OUTPUT_DIR || "./output/";

const tickers = input.split("\n").map((s) => s.trim());

const requestInterval = (60 / 200) * 1.1;

const delay = (s) => new Promise((resolve) => setTimeout(resolve, s * 1000));

const fetchData = async (ticker, page_token) => {
  const paramsInit = {
    start: process.env.START_DATE || "2022-01-01",
    end: process.env.END_DATE || "2022-12-30",
    limit: process.env.LIMIT || 10000,
    timeframe: process.env.TIMEFRAME || "1Min",
  };
  if (page_token) {
    paramsInit.page_token = page_token;
  }

  const res = await fetch(
    `https://data.alpaca.markets/v2/stocks/${ticker}/bars?` +
      new URLSearchParams(paramsInit),
    {
      headers: new Headers({
        "APCA-API-KEY-ID": process.env.APCA_API_KEY_ID,
        "APCA-API-SECRET-KEY": process.env.APCA_API_SECRET_KEY,
      }),
    }
  ).catch((e) => {
    console.log("Error fetching bars for " + ticker + ": " + e);
  });

  const body = await res.json();

  if (!("bars" in body)) {
    console.log("Error fetching bars for " + ticker);
    console.log("Response body: " + JSON.stringify(body));
    return;
  }

  return body;
};

for (const ticker of tickers) {
  let body = await fetchData(ticker);
  await delay(requestInterval); // a bit less than the limit of 200 requests/min
  console.log("successfully fetched bars for " + ticker);
  let initial = true;

  while (body != null) {
    let encoded = "";
    for (const bar of body.bars) {
      const { t, o, h, l, c, v, n, vw } = bar;
      // encoded += `t${t} o${o} h${h} l${l} c${c} v${v} n${n} vw${vw}\n`;
      encoded += `o${o} h${h} l${l} c${c} v${v} n${n} vw${vw}\n`;
    }
    writeFileSync(resolve(outputDir, `${ticker}.txt`), encoded, {
      flag: initial ? undefined : "a+",
    });

    if (body.next_page_token) {
      await delay(requestInterval); // a bit less than the limit of 200 requests/min
      body = await fetchData(ticker, body.next_page_token);
      console.log(
        "successfully fetched bars for " +
          ticker +
          ", next page token: " +
          body.next_page_token
      );
    } else break;
    initial = false;
  }
  await delay(requestInterval); // a bit less than the limit of 200 requests/min
}

console.log("done");
