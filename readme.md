# describe swagger

Transform swagger json to markdown text.

```
const swaggerJson = require('./swagger.json')
const { genSwaggerMdContents } = require('./index.js')
const fs = require('fs')

const md = genSwaggerMdContents(swaggerJson)
fs.writeFileSync('./swagger.md', md)
```
