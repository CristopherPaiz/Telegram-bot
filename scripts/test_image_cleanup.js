const testCleanup = () => {
  const urls = [
    "https://m.media-amazon.com/images/I/512PdVCmliL._AC_SL1300_._AA160_.jpg",
    "https://m.media-amazon.com/images/I/71xyz._AC_SL1500_.jpg",
    "https://example.com/image.jpg",
  ];

  urls.forEach((url) => {
    let clean = url;
    // Misma lógica que en scraper.service.js
    clean = clean.replace(/\._[A-Z]{2}\d+_(\.[a-z]+)?$/, "$1");
    clean = clean.replace(/\._[A-Z]{2}\d+_/, "");

    console.log(`Original: ${url}`);
    console.log(`Clean:    ${clean}`);
    console.log("---");
  });
};

testCleanup();
