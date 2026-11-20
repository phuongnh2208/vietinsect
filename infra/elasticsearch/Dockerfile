FROM docker.elastic.co/elasticsearch/elasticsearch:8.17.0

# Cài plugin analysis-icu hỗ trợ folding dấu tiếng Việt (vi_text analyzer)
RUN bin/elasticsearch-plugin install --batch analysis-icu
