// Import required modules
const puppeteer = require("puppeteer"); // For controlling the browser
const fs = require("fs"); // For writing files to the system
const {
  Parser
} = require("json2csv"); // For converting JSON to CSV format

// Function to extract business data from the page
const extractItems = async (page) => {
  let maps_data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".Nv2PK")).map((el) => {
      const link = el.querySelector("a.hfpxzc") ?.getAttribute("href");
      return {
        title: el.querySelector(".qBF1Pd") ?.textContent.trim(),
        avg_rating: el.querySelector(".MW4etd") ?.textContent.trim(),
        reviews: el.querySelector(".UY7F9") ?.textContent.replace("(", "").replace(")", "").trim(),
        address: el.querySelector(".W4Efsd:last-child > .W4Efsd:nth-of-type(1) > span:last-child") ?.textContent.replaceAll("\u00b7", "").trim(),
        website: el.querySelector("a.lcr4fd") ?.getAttribute("href"),
        category: el.querySelector(".W4Efsd:last-child > .W4Efsd:nth-of-type(1) > span:first-child") ?.textContent.replaceAll("\u00b7", "").trim(),
        phone_num: el.querySelector('.W4Efsd:last-child > .W4Efsd:nth-child(2) > span:nth-child(2) > .UsdlK') ?.textContent.replaceAll("\u00b7", "").trim(),
        latitude: link ?.split("!8m2!3d")[1] ?.split("!4d")[0],
        longitude: link ?.split("!4d")[1] ?.split("!16s")[0],
        link,
      };
    });
  });
  return maps_data;
};

// Function to scroll the page and gather items until the target count is reached
const scrollPage = async (page, scrollContainer, itemTargetCount) => {
  let items = [];
  let previousHeight = 0;

  while (items.length < itemTargetCount) {
    items = await extractItems(page);
    console.log(`Extracted ${items.length} items so far...`);

    const currentHeight = await page.evaluate(`document.querySelector("${scrollContainer}").scrollHeight`);
    if (currentHeight === previousHeight) {
      console.log("No more items to load.");
      break;
    }

    previousHeight = currentHeight;
    await page.evaluate(`document.querySelector("${scrollContainer}").scrollTo(0, ${currentHeight})`);
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  return items;
};

// Function to save business data to a CSV file
const saveToCSV = (data, filename) => {
  const parser = new Parser();
  const csv = parser.parse(data);
  fs.writeFileSync(filename, csv);
  console.log(`Business data saved to ${filename}`);
};

// Function to update the category counts cumulatively
const updateCategoryCounts = (data, cumulativeCounts) => {
  data.forEach((item) => {
    if (item.category) {
      cumulativeCounts[item.category] = (cumulativeCounts[item.category] || 0) + 1;
    }
  });
};

// Main function to start the process of extracting data
const getMapsData = async () => {
  const urls = [
    "https://www.google.com/maps/search/business+in+selangor/@3.1632049,101.5361732,15z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI0MTIxMS4wIKXMDSoASAFQAw%3D%3D",
    "https://www.google.com/maps/search/business+in+kl/@3.1633945,101.4640719,12z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI0MTIxMS4wIKXMDSoASAFQAw%3D%3D",
    "https://www.google.com/maps/search/business+in+perak/@4.6952795,100.8554751,12z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI0MTIxMS4wIKXMDSoASAFQAw%3D%3D",
    "https://www.google.com/maps/search/business+in+johor/@1.5076893,103.6311693,12z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI0MTIxMS4wIKXMDSoASAFQAw%3D%3D"
  ];

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--disable-setuid-sandbox", "--no-sandbox", "--start-maximized"],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4882.194 Safari/537.36",
  });

  let allData = [];
  let categoryCounts = {}; // Cumulative category counts

  for (const url of urls) {
    console.log(`Navigating to URL: ${url}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    let currentPage = 1;
    const maxPages = 1;

    while (currentPage <= maxPages) {
      console.log(`Extracting data from page ${currentPage} of URL: ${url}`);
      let data = await scrollPage(page, ".m6QErb[aria-label]", 320);
      allData = allData.concat(data);

      // Update cumulative category counts
      updateCategoryCounts(data, categoryCounts);

      const nextPageButton = await page.$('button[aria-label=" Next page "]');
      if (nextPageButton) {
        await nextPageButton.click();
        await page.waitForNavigation();
      } else {
        break;
      }

      currentPage++;
    }
  }

  // Remove duplicate entries
  const uniqueData = Array.from(new Set(allData.map(JSON.stringify))).map(JSON.parse);
  console.log(`Total items extracted: ${uniqueData.length}`);

  // Save sorted data
  const sortedData = uniqueData.sort((a, b) => a.category.localeCompare(b.category));
  saveToCSV(sortedData, "business_list_sorted.csv");

  // Convert cumulative counts to an array for saving
  const categoryData = Object.entries(categoryCounts)
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort((a, b) => a.category.localeCompare(b.category)); // Sort categories alphabetically

  const parser = new Parser();
  const csv = parser.parse(categoryData);
  fs.writeFileSync("business_category_count.csv", csv);

  console.log(`Cumulative category count data saved to business_category_count.csv`);
  await browser.close();
};

// Start the process of extracting the data
getMapsData();