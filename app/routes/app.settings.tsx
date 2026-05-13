import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useActionData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.settings.findUnique({
    where: { shop: session.shop },
  });

  return {
    apiKey: settings?.pagespeedApiKey ?? "",
    shop: session.shop,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const apiKey = (formData.get("apiKey") as string)?.trim() || null;

  await prisma.settings.upsert({
    where: { shop: session.shop },
    update: { pagespeedApiKey: apiKey },
    create: { shop: session.shop, pagespeedApiKey: apiKey },
  });

  return { success: true };
};

export default function Settings() {
  const { apiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData, shopify]);

  return (
    <s-page heading="Settings">
      <s-section heading="PageSpeed Insights API Key">
        <Form method="post">
          <s-paragraph>
            A PageSpeed Insights API key increases rate limits from Google.
            Without one, you can still run audits but may be rate-limited after
            several requests. Get a free key from the{" "}
            <s-link
              href="https://developers.google.com/speed/docs/insights/v5/get-started"
              target="_blank"
            >
              Google PageSpeed API documentation
            </s-link>
            .
          </s-paragraph>

          <div style={{ marginTop: "12px" }}>
            <s-password-field
              label="API Key"
              name="apiKey"
              defaultValue={apiKey}
              autocomplete="off"
            />
            <s-text color="subdued">
              Optional — audits work without it but with lower rate limits
            </s-text>
          </div>

          <div style={{ marginTop: "16px" }}>
            <s-button variant="primary" type="submit">
              Save Settings
            </s-button>
          </div>
        </Form>
      </s-section>

      <s-section heading="About Speed Audit">
        <s-paragraph>
          Speed Audit analyzes your Shopify store's performance using Google
          PageSpeed Insights and custom HTML analysis. It provides actionable
          recommendations across performance, SEO, accessibility, and best
          practices — with Shopify-specific insights about app scripts,
          CDN usage, and Liquid rendering.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
