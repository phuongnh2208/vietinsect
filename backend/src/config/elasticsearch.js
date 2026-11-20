"use strict";

const { Client } = require("@elastic/elasticsearch");

const ES_URL = process.env.ELASTICSEARCH_URL || "http://127.0.0.1:9200";

const clientOptions = {
  node: ES_URL,
  requestTimeout: Number(process.env.ES_REQUEST_TIMEOUT_MS) || 5000,
};

if (process.env.ELASTIC_PASSWORD) {
  clientOptions.auth = {
    username: process.env.ELASTIC_USERNAME || "elastic",
    password: process.env.ELASTIC_PASSWORD,
  };
}

const esClient = new Client(clientOptions);

function getIndexName(base) {
  return process.env.NODE_ENV === "test" ? `${base}_test` : base;
}

async function checkEsHealth() {
  try {
    const health = await esClient.cluster.health({ timeout: "2s" });
    return {
      status: "up",
      clusterStatus: health.status,
      numberOfNodes: health.number_of_nodes,
    };
  } catch (err) {
    return {
      status: "down",
      error: err?.message || "Elasticsearch unreachable",
    };
  }
}

module.exports = {
  esClient,
  getIndexName,
  checkEsHealth,
};
