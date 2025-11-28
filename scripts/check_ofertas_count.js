import turso from "../src/config/turso.js";
import "dotenv/config";

const checkCount = async () => {
  try {
    const result = await turso.execute("SELECT COUNT(*) as count FROM Ofertas");
    console.log("Total Ofertas:", result.rows[0].count);

    const sample = await turso.execute("SELECT * FROM Ofertas LIMIT 1");
    console.log("Sample:", JSON.stringify(sample.rows[0], null, 2));
  } catch (error) {
    console.error(error);
  }
};

checkCount();
