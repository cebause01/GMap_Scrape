This is the code to scrape google map data using css selector, puppeteer was used in the code.



-Google limits search results to 120. By adding more links, we can scrape additional data.
-No duplicates are present since the code filters them before parsing to CSV.
-If each circle receives fewer than 120 data entries, increase the timeout, as browser loading time may affect the results.
-A CSV file showing the number of businesses based on categories is generated.
-The age of the businesses is not displayed on Google Maps, so it cannot be scraped.
