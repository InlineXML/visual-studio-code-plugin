# InlineXML Language Extension for VS Code

Write hierarchical tree documents in C# using XML markup syntax with valid HTML elements and custom components.

## Features

- **XML Markup in C#**: Embed structured markup directly in C# code
- **Real-time Parsing & Analysis**: Full language server support with live error reporting
- **Source Map Tracking**: Compilation errors map back to exact locations in your source code
- **Nested & Self-Closing Elements**: Full support for hierarchies with attributes and expressions
- **C# Expression Support**: Use C# expressions directly in markup attributes and nested contexts

## Installation

1. Install the extension from the VS Code Marketplace (search for "InlineXML")
2. The language server will start automatically when you open `.xcs` files (XML-embedded C# files)

## Quick Start

### Build a Tree Structure

```csharp
namespace MyApp.Documents;

using InlineXML;

public static class ReportBuilder
{
    public static object BuildReport(User user) 
    {
        return (
            <div>
                <header>
                    <h1>User Report</h1>
                    <p>{DateTime.Now:yyyy-MM-dd}</p>
                </header>
                <section>
                    <h2>User Information</h2>
                    <span>{user.Name}</span>
                    <p>{user.Email}</p>
                    <p>{user.IsActive}</p>
                </section>
            </div>
        );
    }
}
```

### Iterate Over Collections

```csharp
var users = new[] 
{ 
    new { Id = 1, Name = "Alice" },
    new { Id = 2, Name = "Bob" }
};

return (
    <div>
        <h1>Users</h1>
        <ul>
            {users.Map(user => (
                <li>
                    <span>{user.Name}</span>
                </li>
            ))}
        </ul>
    </div>
);
```

### Use Custom Components

```csharp
return (
    <div>
        <h1>Dashboard</h1>
        <UserProfile UserId={userId} />
        <DataGrid Items={items} />
        <ReportGenerator Config={config} />
    </div>
);
```

## Syntax Guide

### Valid HTML Elements (lowercase only)

The following HTML elements are valid in lowercase:

```
a, abbr, address, area, article, aside, audio,
b, base, bdi, bdo, blockquote, body, br, button,
canvas, caption, cite, code, col, colgroup,
data, datalist, dd, del, details, dfn, dialog, div, dl, dt,
em, embed,
fieldset, figcaption, figure, footer, form,
h1, h2, h3, h4, h5, h6, head, header, hgroup, hr, html,
i, iframe, img, input,
kbd, keygen,
label, legend, li, link,
main, map, mark, menu, menuitem, meta, meter,
nav, noscript,
object, ol, optgroup, option, output,
p, param, picture, pre, progress,
q,
rp, rt, rtc, ruby,
s, samp, script, section, select, slot, small, source, span, strong, style, sub, summary, sup,
table, tbody, td, textarea, tfoot, th, thead, time, title, tr, track,
u, ul,
var, video,
wbr
```

All other lowercase tags are invalid and will generate errors.

### Custom Components (PascalCase only)

For non-HTML structures, use PascalCase component names:

```csharp
<UserProfile />
<DataGrid Items={items} />
<ReportGenerator Config={config} />
<CustomLayout Title="Report">
    <div>Content</div>
</CustomLayout>
```

PascalCase names render as type references to your factory.

### Self-Closing Elements

```csharp
<br />                          // HTML void element
<img src={url} alt={text} />    // With attributes
<UserProfile UserId={123} />    // Custom component
```

### Attributes

```csharp
// String values
<div class="report">

// C# expressions
<div id={id} title={DateTime.Now}>

// Computed values
<ul class={isActive ? "active" : "inactive"}>
```

### Text Content

```csharp
<div>
    Static text content
    <span>{value}</span>
    More text
</div>
```

### Nested Markup in Expressions

```csharp
// Map over items
{items.Map(item => (
    <li key={item.Id}>
        <span>{item.Name}</span>
    </li>
))}

// Conditional structures
{hasError && (
    <div class="error">
        <p>{errorText}</p>
    </div>
)}

{isReady && (
    <section>
        <h2>Results</h2>
        <div>{resultData}</div>
    </section>
)}
```

## How It Works

### Transformation

The extension transforms your XML markup into pure C# factory calls:

**Your Code (.xcs file):**
```csharp
return (
    <div class="report">
        <h1>{title}</h1>
        <CustomContent Data={data} />
    </div>
);
```

**Generated Code (.cs file):**
```csharp
return (
    Document.CreateElement(
        "div",
        new DivProps { Class = "report" },
        Document.CreateElement(
            "h1",
            new H1Props(),
            title
        ),
        Document.CreateElement(
            CustomContent,
            new CustomContentProps { Data = data }
        )
    )
);
```

### Factory Interface

Your factory must implement:
- **First argument**: Element name (string for HTML, symbol for custom components)
- **Second argument**: Properties object (new ElementProps())
- **Remaining arguments**: Child elements or text content

Example factory signature:
```csharp
public static object CreateElement<TProps>(
    string tagName, 
    TProps props,
    params object[] children) where TProps : new()
```

## File Format

- **Extension**: `.xcs` (XML-embedded C#)
- **Namespace**: Standard C# namespaces
- **Compilation**: Transformed to `.cs` files in a `Generated/` folder before build

## Element Rules

### HTML Elements (lowercase)
Only valid HTML tag names are allowed in lowercase:

```csharp
// Valid
<div>Content</div>
<span>Text</span>
<h1>Heading</h1>
<p>Paragraph</p>
<button>Click</button>

// Invalid - not HTML tags
<document>        // ERROR: document is not a valid HTML tag
<report>          // ERROR: report is not a valid HTML tag
<container>       // ERROR: container is not a valid HTML tag
```

### Custom Components (PascalCase)
For custom structures, use PascalCase:

```csharp
// Valid
<Document />
<Report />
<Container>...</Container>
<DataGrid Items={items} />
<UserProfile UserId={123} />
```

## Troubleshooting

### "Invalid HTML tag" error
- Check that you used a valid HTML tag name in lowercase
- Valid HTML tags: `div`, `span`, `p`, `h1-h6`, `section`, `article`, `header`, `footer`, etc.
- For custom structures, use PascalCase instead

### "Unknown component type" error
- Custom components must be in scope (using statement or fully qualified)
- Component names must be PascalCase
- Check that the type actually exists

### "Invalid attribute" error
- Attribute names must correspond to properties on your Props class
- HTML attribute names (kebab-case) map to PascalCase properties
- `content-type` → `ContentType`, `data-id` → `DataId`

### Errors point to wrong location
- The language server tracks source maps automatically
- Errors should reference your `.xcs` file, not generated `.cs`
- If incorrect, please report the issue

## Performance Tips

- **Lazy Evaluation**: Use expressions with `.Map()` to defer nested structure building
- **Keys in Lists**: Use `key=` attributes when mapping for efficient matching
- **Shallow Trees**: Keep nesting depth reasonable for readability
- **Expression Logic**: Complex calculations should be in C# methods, not inline

## Limitations

- **Only Valid HTML**: Lowercase tags must be actual HTML element names
- **Single Root Element**: Always wrap multiple top-level elements in a container
- **No Dynamic Tags**: Tag names must be known at compile time
- **No Spread Operator**: Attributes must be explicitly set
- **Strongly-Typed Props**: Props objects must be concrete classes, not dynamic

## Architecture

The extension uses:
- **Language Server Protocol (LSP)** for VS Code communication
- **Roslyn** for C# syntax tree analysis
- **Custom Parser** for XML tokenization
- **Source Maps** for error position tracking

## Built With

- **Language Server**: .NET 6+
- **VS Code Extension**: TypeScript
- **Communication**: JSON-RPC over stdio

## Contributing

Found a bug or have an idea?
- Open an issue on GitHub
- Include the `.xcs` code that reproduces the issue
- Mention your VS Code and .NET versions

## License

MIT License - See LICENSE file for details

## Resources

- [Roslyn Documentation](https://github.com/dotnet/roslyn)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [HTML Element Reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Element)

## FAQ

**Q: Can I use LINQ in expressions?**
A: Yes. Full C# support: `{items.Where(x => x.Active).Map(...)}`

**Q: Why can't I use custom lowercase tags?**
A: The transformer validates against actual HTML tag names. Use PascalCase for custom structures.

**Q: Can I use one .xcs file from another?**
A: Not directly. Treat `.xcs` outputs as regular C# classes and consume them normally.

**Q: Is there a runtime dependency?**
A: Only your factory implementation. The transformer is compile-time only.

**Q: How does this differ from string interpolation?**
A: Provides proper structure, type safety, validation, and error tracking for hierarchical markup.

---

Start writing .xcs files today.