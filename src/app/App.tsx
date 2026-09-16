import { useState } from "react";
import { ConsoleHeader } from "./components/console/ConsoleHeader";
import { ConsoleLeftNav } from "./components/console/ConsoleLeftNav";
import { ConsoleOverview } from "./components/console/ConsoleOverview";
import { ConsoleSubscriptionsList } from "./components/console/ConsoleSubscriptionsList";
import { ConsoleSubscriptionDetail } from "./components/console/ConsoleSubscriptionDetail";
import { ConsoleAssets } from "./components/console/ConsoleAssets";
import { ConsoleSupportOperations } from "./components/console/ConsoleSupportOperations";
import { ConsoleBillingCost } from "./components/console/ConsoleBillingCost";
import { PoUploadsProvider } from "./context/PoUploadsContext";
import { ConsoleModeProvider, type ConsoleMode } from "./context/ConsoleModeContext";
import {
  mockSubscriptions,
  Subscription,
  userRoles,
  customerTypes,
  type PlatformNavIntent,
  type PlatformNavigateOptions,
} from "./data/mockData";

// Main application component for NetApp BlueXP Console
function App() {
  const [activeScreen, setActiveScreen] = useState("overview");
  const [consoleMode, setConsoleMode] = useState<ConsoleMode>("console");
  const [consoleNavIntent, setConsoleNavIntent] =
    useState<PlatformNavIntent | null>(null);
  const [assetsNavIntent, setAssetsNavIntent] = useState<{
    tab?: "volumes" | "nodes";
    highlightOntapNMinus3?: boolean;
  } | null>(null);
  const [billingCostNavIntent, setBillingCostNavIntent] = useState<{
    tab?: "invoices" | "purchase-orders" | "cost-explorer";
  } | null>(null);
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null);
  /** Set when a just-completed request handed off to its newly activated subscription. */
  const [justActivatedSubscriptionId, setJustActivatedSubscriptionId] =
    useState<string | null>(null);
  const [currentUserRole] = useState(
    userRoles.SUBSCRIPTION_ADMIN,
  );
  const [currentCustomerType] = useState(customerTypes.DIRECT);

  const currentUser = {
    name: "Vedant Sethia",
    role: currentUserRole,
    customerType: currentCustomerType,
  };

  const handleNavigate = (
    screen: string,
    subscriptionId?: string,
    options?: PlatformNavigateOptions,
  ) => {
    if (subscriptionId) {
      setConsoleNavIntent(null);
      setAssetsNavIntent(null);
      const subscription = mockSubscriptions.find(
        (s) => s.id === subscriptionId,
      );
      if (subscription) {
        setSelectedSubscription(subscription);
        setActiveScreen("subscription-detail");
      }
      return;
    }

    setActiveScreen(screen);

    if (screen === "assets") {
      if (options?.assetsTab != null) {
        setAssetsNavIntent({
          tab: options.assetsTab,
          highlightOntapNMinus3: options.highlightOntapNMinus3 ?? false,
        });
      } else {
        setAssetsNavIntent(null);
      }
    } else {
      setAssetsNavIntent(null);
    }

    if (screen === "billing-cost") {
      setBillingCostNavIntent({ tab: options?.billingCostTab });
    } else {
      setBillingCostNavIntent(null);
    }

    if (options && screen === "support") {
      setConsoleNavIntent({
        screen: "support",
        supportTab: options.supportTab,
        highlightServiceRequestId: options.highlightServiceRequestId,
        highlightSupportCaseId: options.highlightSupportCaseId,
        highlightAlertId: options.highlightAlertId,
      });
    } else {
      setConsoleNavIntent(null);
    }
  };

  const handleSelectSubscription = (
    subscription: Subscription,
    options?: { justActivated?: boolean },
  ) => {
    setSelectedSubscription(subscription);
    setJustActivatedSubscriptionId(
      options?.justActivated ? subscription.id : null,
    );
    setActiveScreen("subscription-detail");
  };

  const handleBackToList = () => {
    setSelectedSubscription(null);
    setJustActivatedSubscriptionId(null);
    setActiveScreen("subscriptions");
  };

  const handleConsoleModeChange = (mode: ConsoleMode) => {
    if (mode === consoleMode) return;
    setConsoleMode(mode);
    setActiveScreen("overview");
    setSelectedSubscription(null);
    setConsoleNavIntent(null);
    setAssetsNavIntent(null);
    setBillingCostNavIntent(null);
  };

  const renderScreen = () => {
    if (
      activeScreen === "subscription-detail" &&
      selectedSubscription
    ) {
      return (
        <ConsoleSubscriptionDetail
          subscription={selectedSubscription}
          onBack={handleBackToList}
          onNavigate={handleNavigate}
          justActivated={
            justActivatedSubscriptionId === selectedSubscription.id
          }
        />
      );
    }

    switch (activeScreen) {
      case "overview":
        return (
          <ConsoleOverview
            onNavigate={handleNavigate}
          />
        );
      case "subscriptions":
        return (
          <ConsoleSubscriptionsList
            onSelectSubscription={handleSelectSubscription}
          />
        );
      case "billing-cost":
        return (
          <ConsoleBillingCost
            initialTab={billingCostNavIntent?.tab}
            onSelectSubscription={handleSelectSubscription}
            onNavigate={handleNavigate}
          />
        );
      case "assets":
        return (
          <ConsoleAssets
            initialTab={assetsNavIntent?.tab}
            highlightOntapNMinus3={assetsNavIntent?.highlightOntapNMinus3}
            onIntentConsumed={() => setAssetsNavIntent(null)}
          />
        );
      case "support":
        return (
          <ConsoleSupportOperations
            navIntent={
              consoleNavIntent?.screen === "support"
                ? consoleNavIntent
                : null
            }
            onNavIntentConsumed={() => setConsoleNavIntent(null)}
          />
        );
      default:
        return (
          <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <div className="text-gray-400 mb-2">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {activeScreen === "assets" && "Assets View"}
                {activeScreen === "sla-health" &&
                  "SLA & Health Dashboard"}
                {activeScreen === "billing" &&
                  "Billing & Invoices"}
                {activeScreen === "recommendations" &&
                  "Recommendations"}
                {activeScreen === "collectors" &&
                  "Collectors/Agents"}
                {activeScreen === "settings" && "Settings"}
              </h3>
              <p className="text-sm text-gray-500">
                This section is available at the subscription
                level. Select a subscription to view details.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <ConsoleModeProvider mode={consoleMode} setMode={handleConsoleModeChange}>
      <PoUploadsProvider>
        <div className="min-h-screen bg-[#f5f5f5]">
          <ConsoleHeader
            currentUser={currentUser}
            onNavigate={handleNavigate}
            consoleMode={consoleMode}
            onConsoleModeChange={handleConsoleModeChange}
          />
          <ConsoleLeftNav
            activeScreen={activeScreen}
            onNavigate={(screen) => handleNavigate(screen)}
            consoleMode={consoleMode}
          />
          <div style={{ marginLeft: "228px", marginTop: "72px" }}>
            {renderScreen()}
          </div>
        </div>
      </PoUploadsProvider>
    </ConsoleModeProvider>
  );
}

export default App;