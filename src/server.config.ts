import fs from "fs";
import path from "path";

const extractTypeDefs = (schemaDir: string) => {
  const typeDefs = fs
    .readdirSync(schemaDir)
    .filter((file) => file.endsWith(".graphql") || file.endsWith(".gql"))
    .map((file) => fs.readFileSync(path.join(schemaDir, file), "utf8"));

  return typeDefs;
};

export { extractTypeDefs };