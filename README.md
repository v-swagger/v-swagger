# V-Swagger README

Visualize Swagger (V-Swagger) is a VS Code extension that is able to parse and preview Swagger/OpenAPI definition locally either in VS Code Webview panel or Browsers.

## Table of Content

1. [Details We Value](#details-we-value)
2. [Functions We Provide](#functions-we-provide)
3. [Contributions We Welcome](#contributions-we-welcome)
4. [Architecture We Build](#architecture-we-build)
5. [Things We Do](#things-we-do)

## Details We Value

-   **Performance**: The parsed results of Swagger YAML files are cached to ensure optimal performance. Reparsing occurs only when changes are saved to disk, and all updates are displayed in the corresponding UI instantly.

-   **Improved File Reference**: The use of Swagger $ref is crucial for managing complex API definitions. With support for path rewriting (configurable in custom settings), V-Swagger offers greater flexibility in handling API definitions based on file references.

-   **Error Handling**: V-Swagger prioritizes user experience by avoiding blank pages in case of fatal errors. Instead, users are provided with appropriate alerts. The project roadmap includes plans to introduce syntax check highlighting in the near future.

## Functions We Provide

<img src="https://0x400.com/images/V-Swagger/preview-demo-v1.gif" width="800">

**Preview Swagger Definition**

<img src="https://0x400.com/images/V-Swagger/preview-button.png" width="800">

**Configurations**

Open user settings, filter by "V-Swagger" keyword,
<img src="https://0x400.com/images/V-Swagger/extension-config.png" width="800">

## Contributions We Welcome

### Get started

Read the dev documentation firstly: https://code.visualstudio.com/api/get-started/your-first-extension

### Setup local dev env

```shell
git clone git@github.com:brelian/V-Swagger.git
cd V-Swagger
npm install
npm run compile
```

Press F5 to start extension with debugging mode. Or click on the debugging button in the left menu list, you will be able to execute "Run Extension" script manually to start debugging the extension.

<img src="https://0x400.com/images/V-Swagger/start-debugging.jpg" width="300">

Refer to [debugging-the-extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension)

## Architecture We Build

<img src="https://0x400.com/images/V-Swagger/V-Swagger-architecture.png" width="800">

## Things We Do

![](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/LangInteger/learning/master/draw/swagger/client_and_server_interact.puml)
