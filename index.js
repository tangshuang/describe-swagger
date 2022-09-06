function parseSwaggerSchemaToText(schema) {
  const { host, basePath, paths, definitions } = schema;
  const uris = Object.keys(paths);

  const results = [];

  uris.forEach((uri) => {
    const url = `${basePath}${uri}`;
    const items = paths[uri];
    const methods = Object.keys(items);

    methods.forEach((method) => {
      const item = items[method];
      const { tags, summary, operationId, parameters = [], responses } = item;

      const request = parseRequest(parameters, definitions);
      const response = parseResponse(responses, definitions);

      const action = {
        method,
        url,
        uri,
        summary,
        name: operationId,
        tags,
        request,
        response,
      };
      results.push(action);
    });
  });

  return results;
}

function parseRequest(parameters, definitions) {
  const headers = [];
  let data = null;
  const searchQuery = [];
  const pathParams = [];

  parameters.forEach((item) => {
    const { in: place, ...others } = item;
    if (place === 'query') {
      searchQuery.push(others);
    } else if (place === 'body') {
      const { schema } = others;
      const body = parseJsonSchema(schema, definitions);
      // 只会有一个
      data = body;
    } else if (place === 'header') {
      headers.push(others);
    } else if (place === 'path') {
      pathParams.push(others);
    }
  });

  return {
    headers: parseParams(headers),
    data,
    searchQuery: parseParams(searchQuery),
    pathParams: parseParams(pathParams),
  };
}

function parseResponse(responses, definitions) {
  const success = responses['200'];
  const { schema } = success;
  const body = parseJsonSchema(schema, definitions);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return body;
}

function parseJsonSchema(jsonSchema, definitions, deep = 0, atKey = '', parentVO = []) {
  const { type, description, format, originalRef } = jsonSchema;
  let text = '';

  if (description && deep) {
    text += `${atKey ? indent(deep) : ''}// ${description}\n${atKey ? '' : indent(deep)}`;
  }
  if (originalRef && deep) {
    text += `${atKey ? `${indent(deep)}` : ''}// @((${originalRef}))\n${atKey ? '' : indent(deep)}`;
  }

  if (atKey) {
    text += `${indent(deep)}${atKey}: `;
  }

  if (type === 'object') {
    const { properties } = jsonSchema;
    if (!properties) {
      text += `{}`;
    } else {
      const keys = Object.keys(properties);
      text += '{';
      const inners = [];
      keys.forEach((key) => {
        const prop = properties[key];
        inners.push(parseJsonSchema(prop, definitions, deep + 1, key, parentVO));
      });
      if (inners.length) {
        text += '\n';
        text += inners.map(item => item.trimEnd()).join('\n');
        text += '\n';
      }
      text += `${indent(deep)}}\n`;
    }
  } else if (type === 'array') {
    const { items } = jsonSchema;
    const itemText = parseJsonSchema(items, definitions, deep + 1, 0, parentVO);
    const hasBreak = itemText.indexOf('\n') > -1;
    if (hasBreak) {
      text += `[\n${indent(deep + 1)}${itemText.trimEnd()}\n${indent(deep)}]\n`;
    } else {
      text += `[${itemText.trim()}]\n`;
    }
  } else if (type) {
    text += format || type;
  } else if (originalRef) {
    const def = definitions[originalRef];
    // 避免循环嵌套
    if (parentVO.indexOf(originalRef) > -1) {
      text += `@@${originalRef}))`;
    } else {
      if (def) {
        text += parseJsonSchema(def, definitions, deep, atKey === 0 ? 0 : '', [...parentVO, originalRef]);
      } else {
        text += null;
      }
    }
  }
  return text;
}

function parseParams(params) {
  const lines = [];
  params.forEach((item) => {
    const { name, description, required, type, items, format } = item;
    if (description) {
      const line = `${indent(1)}// ${description}`;
      lines.push(line);
    }

    let text = format || type;
    if (type === 'array' && items) {
      const { type } = items;
      text = `[${type}]` || text;
    }

    const line = `${indent(1)}${name}${required ? '' : '?'}: ${text}`;
    lines.push(line);
  });
  if (!lines.length) {
    return null;
  }
  return `{\n${lines.join('\n')}\n}`;
}

function indent(deep) {
  const indent = new Array(deep * 4).fill(' ').join('');
  return indent;
}

function genSwaggerMdContents(json) {
  const apis = parseSwaggerSchemaToText(json);
  const categories = {};
  apis.forEach((item) => {
    const { tags = ['Default'], ...others } = item;
    tags.forEach((tag) => {
      categories[tag] = categories[tag] || [];
      categories[tag].push(others);
    });
  });
  const apiTexts = ['[TOC]'];
  const catNames = Object.keys(categories);
  catNames.forEach((catName) => {
    apiTexts.push(`# ${catName}`);
    const items = categories[catName];
    items.forEach((item) => {
      const {
        method,
        url,
        uri,
        summary,
        name,
        request: { headers, data, searchQuery, pathParams },
        response,
      } = item;

      let text = `## ${uri} ${summary || ''}\n`;

      if (summary) {
        text += `\n${name} ${summary}\n`;
      }

      if (headers) {
        text += `\n**Headers:**\n`;
        text += '```';
        text += `\n${headers}\n`;
        text += '```\n';
      }

      if (searchQuery) {
        text += `\n**SearchQueryParams:**\n`;
        text += '```';
        text += `\n${searchQuery}\n`;
        text += '```\n';
      }

      if (pathParams) {
        text += `\n**PathParams:**\n`;
        text += '```';
        text += `\n${pathParams}\n`;
        text += '```\n';
      }

      text += '\n**Request->Response:**\n';
      text += '```\n';
      text += `${method.toUpperCase()} "${url}"`;
      if (data) {
        text += ` + ${data.trim()}`;
      }
      text += ` -> ${response.trim()}`;
      text += '\n```\n';

      apiTexts.push(text);
    });
  });

  const apiContents = apiTexts.join('\n\n');
  return apiContents;
}

module.exports = {
  parseSwaggerSchemaToText,
  genSwaggerMdContents,
};
