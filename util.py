import click
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options


def fetch_rendered_html_without_js(url: str, timeout: int = 15) -> str:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    with webdriver.Chrome(options=options) as driver:
        driver.set_page_load_timeout(timeout)
        driver.get(url)
        rendered_html = driver.page_source

    soup = BeautifulSoup(rendered_html, "html.parser")

    for tag in soup(["script", "noscript"]):
        tag.decompose()

    for element in soup():
        attrs_to_remove = [
            attr
            for attr, val in element.attrs.items()
            if attr.startswith("on") or str(val).lower().startswith("javascript:")
        ]
        for attr in attrs_to_remove:
            del element.attrs[attr]

    return soup.prettify()


@click.command()
@click.argument("url")
@click.option("-t", "--timeout", default=15, show_default=True, type=int)
@click.option("-o", "--output", type=click.File("w", encoding="utf-8"), default="-")
def main(url: str, timeout: int, output) -> None:
    html = fetch_rendered_html_without_js(url, timeout)
    output.write(html)


if __name__ == "__main__":
    main()
