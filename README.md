# v-swagger README

View Swagger (v-swagger) is a VS Code extension that is able to parse and preview Swagger/OpenAPI definition locally either in VS Code Webview panel or Browsers.

## Usage

**Build internal extension by running:**

```shell
npm run package
```

Install it,
![install](https://0x400.com/images/v-swagger/install-from-file.png)

**Preview Swagger Definition**

![preview](https://0x400.com/images/v-swagger/preview-button.png)

**Configurations**

Open user settings, filter by "v-swagger" keyword,
![setting](https://0x400.com/images/v-swagger/extension-config.png)

## Development

### Get started

Read the dev documentation firstly: https://code.visualstudio.com/api/get-started/your-first-extension

### Setup local dev env

```shell
git clone git@github.com:brelian/v-swagger.git
cd v-swagger
npm install
npm run compile
```

Press F5 to start extension with debugging mode. Or click on the debugging button in the left menu list, you will be able to execute "Run Extension" script manually to start debugging the extension.
![](https://0x400.com/images/v-swagger/start-debugging.jpg)

Refer to [debugging-the-extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension)

## Architecture

![](https://0x400.com/images/v-swagger/v-swagger-architecture.png)

## How does it work

![](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/LangInteger/learning/master/draw/swagger/client_and_server_interact.puml)

## Why I create v-swagger from scrach

A couple of weeks ago, in order to meet the special needs of my project, I extended a path rewrite function to [Intelliji Swagger](https://github.com/zalando/intellij-swagger) consumed by Webstorm.
Unfortunately, WebStorm is very slow in my daily use and can't guarantee my development efficiency. Therefore, I switched from WebStorm to VS Code recently. Although VS Code has many shortcomings compared to IntelliJ products, its Remote development function has greatly improved my development efficiency. Therefore, I need a VS Code extension similar to [intellij-swagger](https://github.com/zalando/intellij-swagger). At present, the two popular extensions to preview Swagger/OpenAPI definition.

-   [Swagger Viewer](https://marketplace.visualstudio.com/items?itemName=Arjun.swagger-viewer)
-   [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi)

However, they can't meet my special scenario where I need a path rewrite rule to make preview working. In the end, I decided to build my own VS Code extension for the following reasons:

1. I need to support path rewrite, which is not supported by current popular extensions.
2. I can directly modify one of the popular extensions, just like I modified IntelliJ Swagger before. However, its code quality did not meet my expectations.
