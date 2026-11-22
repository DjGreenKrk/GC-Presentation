// GC-Presentation Raw Input helper (Windows only).
//
// Separate, opt-in process. --list enumerates keyboard HID devices without
// recording keys. --watch <exact-device-path> forwards only key up/down from
// that explicitly selected device. It never installs a global keyboard hook,
// intercepts other devices, captures text, or blocks ordinary Windows input.
//
// stdout is line-delimited UTF-8 JSON; stderr is diagnostics only.
// No third-party libraries, no administrator privileges required.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <algorithm>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>
#include <cwchar>

namespace {
HANDLE selectedDevice = nullptr;

std::string toUtf8(const std::wstring& text) {
  if (text.empty()) return {};
  const int length = WideCharToMultiByte(CP_UTF8, 0, text.data(),
                                        static_cast<int>(text.size()),
                                        nullptr, 0, nullptr, nullptr);
  if (length <= 0) return {};
  std::string utf8(static_cast<size_t>(length), '\0');
  if (WideCharToMultiByte(CP_UTF8, 0, text.data(),
                          static_cast<int>(text.size()),
                          utf8.data(), length, nullptr, nullptr) <= 0) return {};
  return utf8;
}

std::string escapeJson(const std::string& text) {
  std::ostringstream out;
  for (unsigned char c : text) {
    switch (c) {
      case '\\': out << "\\\\"; break;
      case '"': out << "\\\""; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (c < 0x20) {
          out << "\\u00" << std::uppercase << std::hex
              << std::setfill('0') << std::setw(2)
              << static_cast<unsigned int>(c) << std::dec;
        } else {
          out << static_cast<char>(c);
        }
    }
  }
  return out.str();
}

void output(const std::string& json) {
  std::cout << json << '\n' << std::flush;
}

// A handle is valid only for this session and must never be persisted.
// Device paths can change after unplugging or swapping ports; the UI will
// need to request explicit reconfirmation if the selected path disappears.
std::wstring devicePath(HANDLE device) {
  UINT length = 0;
  if (GetRawInputDeviceInfoW(device, RIDI_DEVICENAME, nullptr, &length) ==
      static_cast<UINT>(-1) || length == 0 || length > 32768) return {};

  std::wstring buffer(static_cast<size_t>(length), L'\0');
  if (GetRawInputDeviceInfoW(device, RIDI_DEVICENAME, buffer.data(), &length) ==
      static_cast<UINT>(-1)) return {};
  const size_t zero = buffer.find(L'\0');
  if (zero != std::wstring::npos) buffer.resize(zero);
  return buffer;
}

std::vector<RAWINPUTDEVICELIST> keyboards() {
  UINT count = 0;
  if (GetRawInputDeviceList(nullptr, &count, sizeof(RAWINPUTDEVICELIST)) ==
      static_cast<UINT>(-1)) return {};

  std::vector<RAWINPUTDEVICELIST> devices(count);
  if (count == 0) return {};
  UINT found = GetRawInputDeviceList(devices.data(), &count,
                                     sizeof(RAWINPUTDEVICELIST));
  if (found == static_cast<UINT>(-1)) return {};
  devices.resize(found);
  devices.erase(
    std::remove_if(devices.begin(), devices.end(),
                   [](const RAWINPUTDEVICELIST& device) {
                     return device.dwType != RIM_TYPEKEYBOARD;
                   }),
    devices.end()
  );
  return devices;
}

std::wstring displayName(const std::wstring& path) {
  const size_t vendor = path.find(L"VID_");
  const size_t product = path.find(L"PID_");
  if (vendor != std::wstring::npos && product != std::wstring::npos &&
      vendor + 8 <= path.size() && product + 8 <= path.size()) {
    return L"Klawiatura HID " + path.substr(vendor, 8) +
           L" " + path.substr(product, 8);
  }
  return L"Klawiatura (Raw Input)";
}

int listDevices() {
  for (const auto& item : keyboards()) {
    const std::wstring path = devicePath(item.hDevice);
    if (path.empty()) continue;
    output("{\"type\":\"device\",\"id\":\"" + escapeJson(toUtf8(path)) +
           "\",\"label\":\"" + escapeJson(toUtf8(displayName(path))) + "\"}");
  }
  return 0;
}

HANDLE findDevice(const std::wstring& selectedPath) {
  for (const auto& item : keyboards()) {
    const std::wstring path = devicePath(item.hDevice);
    if (!path.empty() && _wcsicmp(path.c_str(), selectedPath.c_str()) == 0) {
      return item.hDevice;
    }
  }
  return nullptr;
}

void handleInput(HRAWINPUT handle) {
  UINT size = 0;
  if (GetRawInputData(handle, RID_INPUT, nullptr, &size,
                      sizeof(RAWINPUTHEADER)) != 0 ||
      size < sizeof(RAWINPUTHEADER) || size > 32768) return;

  std::unique_ptr<BYTE[]> buffer(new BYTE[size]);
  const UINT bytes = GetRawInputData(handle, RID_INPUT, buffer.get(), &size,
                                    sizeof(RAWINPUTHEADER));
  if (bytes == static_cast<UINT>(-1) || bytes < sizeof(RAWINPUTHEADER)) return;

  const auto* raw = reinterpret_cast<const RAWINPUT*>(buffer.get());
  if (raw->header.dwType != RIM_TYPEKEYBOARD ||
      raw->header.hDevice != selectedDevice) return;

  const RAWKEYBOARD& key = raw->data.keyboard;
  if (key.VKey == 255) return; // Keyboard overrun / fake input.
  std::ostringstream code;
  code << "kbd:";
  if (key.MakeCode != 0) {
    code << "scan:0x" << std::uppercase << std::hex << std::setw(2)
         << std::setfill('0') << static_cast<unsigned int>(key.MakeCode);
    if ((key.Flags & RI_KEY_E0) != 0) code << ":e0";
    if ((key.Flags & RI_KEY_E1) != 0) code << ":e1";
  } else {
    code << "vkey:0x" << std::uppercase << std::hex << std::setw(2)
         << std::setfill('0') << static_cast<unsigned int>(key.VKey);
  }
  output("{\"type\":\"event\",\"code\":\"" + code.str() +
         "\",\"phase\":\"" + ((key.Flags & RI_KEY_BREAK) ? "up" : "down") +
         "\"}");
}

LRESULT CALLBACK windowProc(HWND window, UINT message,
                            WPARAM wParam, LPARAM lParam) {
  switch (message) {
    case WM_INPUT:
      // Windows requires cleanup through DefWindowProc after GetRawInputData.
      handleInput(reinterpret_cast<HRAWINPUT>(lParam));
      break;
    case WM_INPUT_DEVICE_CHANGE:
      if (wParam == GIDC_REMOVAL &&
          reinterpret_cast<HANDLE>(lParam) == selectedDevice) {
        output(R"({"type":"disconnected"})");
        PostQuitMessage(0);
      }
      return 0;
    case WM_DESTROY:
      PostQuitMessage(0);
      return 0;
    default:
      break;
  }
  return DefWindowProcW(window, message, wParam, lParam);
}

int watchDevice(const std::wstring& path, HINSTANCE instance) {
  selectedDevice = findDevice(path);
  if (!selectedDevice) {
    std::cerr << "Selected keyboard receiver is not connected\n";
    return 3;
  }

  const wchar_t* className = L"GC_Presentation_RawInput";
  WNDCLASSW wc{};
  wc.lpfnWndProc = windowProc;
  wc.hInstance = instance;
  wc.lpszClassName = className;
  if (!RegisterClassW(&wc)) {
    std::cerr << "RegisterClassW failed\n";
    return 4;
  }

  // A hidden ordinary window is used instead of a message-only window: it
  // reliably receives RIDEV_INPUTSINK when another app is in the foreground.
  HWND window = CreateWindowExW(0, className, L"GC-Presentation HID",
                               WS_OVERLAPPED, 0, 0, 0, 0,
                               nullptr, nullptr, instance, nullptr);
  if (!window) {
    std::cerr << "CreateWindowExW failed\n";
    return 5;
  }

  RAWINPUTDEVICE keyboard{};
  keyboard.usUsagePage = 0x01;
  keyboard.usUsage = 0x06;
  keyboard.dwFlags = RIDEV_INPUTSINK | RIDEV_DEVNOTIFY;
  keyboard.hwndTarget = window;
  if (!RegisterRawInputDevices(&keyboard, 1, sizeof(keyboard))) {
    std::cerr << "RegisterRawInputDevices failed\n";
    DestroyWindow(window);
    return 6;
  }

  output(R"({"type":"ready"})");
  MSG message{};
  while (true) {
    const BOOL read = GetMessageW(&message, nullptr, 0, 0);
    if (read == 0) break;
    if (read < 0) {
      DestroyWindow(window);
      return 7;
    }
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }

  if (IsWindow(window)) DestroyWindow(window);
  return 0;
}
}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  // All IO is over pipes: a parent process runs this with windowsHide:true.
  if (argc == 2 && std::wcscmp(argv[1], L"--list") == 0) {
    return listDevices();
  }
  if (argc == 3 && std::wcscmp(argv[1], L"--watch") == 0 &&
      argv[2][0] != L'\0') {
    return watchDevice(argv[2], GetModuleHandleW(nullptr));
  }
  std::cerr << "Usage: gc-raw-input.exe --list | --watch <device-path>\n";
  return 2;
}
