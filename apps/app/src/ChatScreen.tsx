import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { io, type Socket } from "socket.io-client";
import type { SessionUser } from "@viteg/shared";
import { api, SOCKET_URL } from "./api";
import { colors, radius } from "./theme";

type Worker = {
  _id: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "DRIVER";
  photoUrl?: string;
};

type Attachment = {
  url: string;
  storageKey?: string;
  kind: "IMAGE" | "VIDEO";
  name?: string;
  mimeType?: string;
  size?: number;
};

type Message = {
  _id: string;
  conversationId: string;
  senderId: string | Worker;
  type: "TEXT" | "IMAGE" | "VIDEO";
  text?: string;
  attachments?: Attachment[];
  createdAt: string;
  readBy?: string[];
};

type Conversation = {
  _id: string;
  participants: Worker[];
  lastMessageAt?: string;
  lastMessage?: Message;
  unreadCount?: number;
};

function workerName(worker?: Worker) {
  return worker ? `${worker.firstName} ${worker.lastName}`.trim() : "Trabajador VITEG";
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "V";
}

function senderId(message: Message) {
  return typeof message.senderId === "string" ? message.senderId : message.senderId._id;
}

function conversationId(message: Message) {
  const value: any = message.conversationId;
  return String(value?._id ?? value);
}

function shortTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function previewText(message?: Message) {
  if (!message) return "Inicia la conversación";
  if (message.type === "IMAGE") return `📷 ${message.text || "Imagen"}`;
  if (message.type === "VIDEO") return `🎥 ${message.text || "Video"}`;
  return message.text || "Mensaje";
}

export type ChatScreenHandle = { handleBack: () => boolean };

export const ChatScreen = forwardRef<
  ChatScreenHandle,
  { user: SessionUser; onKeyboardVisibilityChange?: (visible: boolean) => void }
>(function ChatScreen({ user, onKeyboardVisibilityChange }, ref) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      if (previewImage) { setPreviewImage(null); return true; }
      if (attachmentOpen) { setAttachmentOpen(false); return true; }
      if (peopleOpen) { setPeopleOpen(false); return true; }
      if (selected) {
        Keyboard.dismiss();
        setSelected(null);
        setMessages([]);
        void loadConversations();
        return true;
      }
      return false;
    }
  }), [attachmentOpen, peopleOpen, previewImage, selected]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => onKeyboardVisibilityChange?.(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => onKeyboardVisibilityChange?.(false));
    return () => {
      show.remove();
      hide.remove();
      onKeyboardVisibilityChange?.(false);
    };
  }, [onKeyboardVisibilityChange]);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.conversations());
    } catch (error) {
      Alert.alert("Chat", error instanceof Error ? error.message : "No se pudieron cargar las conversaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      setMessages(await api.conversationMessages(id));
    } catch (error) {
      Alert.alert("Conversación", error instanceof Error ? error.message : "No se pudieron cargar los mensajes");
    }
  }, []);

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    void loadConversations();
    void api.chatWorkers().then(setWorkers).catch(() => undefined);
    let active = true;
    void api.sessionToken().then((token) => {
      if (!active || !token) return;
      const socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });
      socketRef.current = socket;
      socket.on("message:new", (message: Message) => {
        if (conversationId(message) === selectedIdRef.current) appendMessage(message);
        void loadConversations();
      });
    });
    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [appendMessage, loadConversations]);

  useEffect(() => {
    if (selected) return;
    const timer = setInterval(() => void loadConversations(), 10000);
    return () => clearInterval(timer);
  }, [loadConversations, selected]);

  useEffect(() => {
    selectedIdRef.current = selected?._id ?? null;
    if (!selected) return;
    void loadMessages(selected._id);
    socketRef.current?.emit("conversation:join", selected._id);
    const timer = setInterval(() => void loadMessages(selected._id), 10000);
    return () => clearInterval(timer);
  }, [loadMessages, selected]);

  const otherWorker = useCallback((conversation: Conversation) => (
    conversation.participants.find((participant) => participant._id !== user.id)
  ), [user.id]);

  const filteredWorkers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    if (!query) return workers;
    return workers.filter((worker) => `${worker.firstName} ${worker.lastName} ${worker.role}`.toLocaleLowerCase("es-MX").includes(query));
  }, [search, workers]);

  const openWorker = async (worker: Worker) => {
    try {
      const conversation = await api.openConversation(worker._id) as Conversation;
      setPeopleOpen(false);
      setSearch("");
      setSelected(conversation);
      await loadConversations();
    } catch (error) {
      Alert.alert("Nueva conversación", error instanceof Error ? error.message : "No se pudo abrir el chat");
    }
  };

  const sendPayload = async (payload: { type: "TEXT" | "IMAGE" | "VIDEO"; text?: string; attachments?: Attachment[] }) => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const socket = socketRef.current;
      const message = await new Promise<Message>((resolve, reject) => {
        if (!socket?.connected) {
          void api.sendMessage(selected._id, payload).then(resolve).catch(reject);
          return;
        }
        socket.timeout(10000).emit("message:send", { conversationId: selected._id, ...payload }, (error: Error | null, result: any) => {
          if (error) reject(new Error("No se recibió respuesta del servidor"));
          else if (!result?.ok) reject(new Error(result?.error || "No se pudo enviar el mensaje"));
          else resolve(result.data);
        });
      });
      appendMessage(message);
      setText("");
      await loadConversations();
    } catch (error) {
      Alert.alert("No se pudo enviar", error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    const value = text.trim();
    if (value) void sendPayload({ type: "TEXT", text: value });
  };

  const pickMedia = async (kind: "IMAGE" | "VIDEO") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso necesario", "Permite el acceso a tus fotos y videos para compartirlos en el chat.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "IMAGE" ? ["images"] : ["videos"],
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 120
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 50 * 1024 * 1024) {
      Alert.alert("Archivo demasiado grande", "El límite por imagen o video es de 50 MB.");
      return;
    }
    setSending(true);
    try {
      const attachment = await api.uploadChatMedia({
        uri: asset.uri
      }) as Attachment;
      setSending(false);
      await sendPayload({ type: kind, attachments: [attachment] });
    } catch (error) {
      setSending(false);
      Alert.alert("No se pudo adjuntar", error instanceof Error ? error.message : String(error));
    }
  };

  if (selected) {
    const worker = otherWorker(selected);
    const name = workerName(worker);
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={styles.chatRoot}
      >
        <View style={styles.chatHeader}>
          <Pressable onPress={() => { setSelected(null); setMessages([]); void loadConversations(); }} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={23} color={colors.ink} />
          </Pressable>
          <Avatar name={name} photoUrl={worker?.photoUrl} size={42} />
          <View style={styles.chatHeaderText}>
            <Text numberOfLines={1} style={styles.chatName}>{name}</Text>
            <Text style={styles.chatRole}>{worker?.role === "ADMIN" ? "Administrador" : "Repartidor"} · VITEG</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.secureNotice}>
              <Ionicons name="lock-closed" size={16} color="#756B43" />
              <Text style={styles.secureText}>Chat interno de VITEG. Solo los trabajadores participantes pueden ver estos mensajes.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              mine={senderId(item) === user.id}
              onOpenImage={setPreviewImage}
            />
          )}
        />

        {sending && <View style={styles.uploading}><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.uploadingText}>Enviando…</Text></View>}
        <View style={styles.composer}>
          <Pressable
            disabled={sending}
            style={styles.attachButton}
            onPress={() => { Keyboard.dismiss(); setAttachmentOpen(true); }}
          >
            <Ionicons name="add" size={28} color={colors.blue} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Mensaje"
            placeholderTextColor="#829AB1"
            multiline
            maxLength={2000}
            style={styles.messageInput}
          />
          <Pressable disabled={sending || !text.trim()} onPress={sendText} style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}>
            <Ionicons name="send" size={20} color="white" />
          </Pressable>
        </View>

        <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={styles.previewBackdrop}>
            <Pressable style={styles.previewClose} onPress={() => setPreviewImage(null)}>
              <Ionicons name="close" size={26} color="white" />
            </Pressable>
            {previewImage && <Image source={{ uri: previewImage }} resizeMode="contain" style={styles.previewImage} />}
          </View>
        </Modal>

        <Modal visible={attachmentOpen} transparent animationType="slide" onRequestClose={() => setAttachmentOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setAttachmentOpen(false)}>
            <Pressable style={styles.attachmentSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Compartir archivo</Text>
              <Text style={styles.sheetSubtitle}>Selecciona contenido de tu galería</Text>
              <View style={styles.attachmentOptions}>
                <Pressable style={styles.attachmentOption} onPress={() => { setAttachmentOpen(false); void pickMedia("IMAGE"); }}>
                  <View style={[styles.attachmentIcon, { backgroundColor: "#E8F8F3" }]}>
                    <Ionicons name="image-outline" size={30} color={colors.green} />
                  </View>
                  <Text style={styles.attachmentTitle}>Imagen</Text>
                  <Text style={styles.attachmentDescription}>Fotos y capturas</Text>
                </Pressable>
                <Pressable style={styles.attachmentOption} onPress={() => { setAttachmentOpen(false); void pickMedia("VIDEO"); }}>
                  <View style={[styles.attachmentIcon, { backgroundColor: "#F3E8FF" }]}>
                    <Ionicons name="videocam-outline" size={30} color="#7C3AED" />
                  </View>
                  <Text style={styles.attachmentTitle}>Video</Text>
                  <Text style={styles.attachmentDescription}>Hasta 50 MB</Text>
                </Pressable>
              </View>
              <Pressable style={styles.cancelAttachment} onPress={() => setAttachmentOpen(false)}>
                <Text style={styles.cancelAttachmentText}>Cancelar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.subtitle}>Mensajería interna de VITEG</Text>
        </View>
        <Pressable onPress={() => setPeopleOpen(true)} style={styles.newChatButton}>
          <Ionicons name="create-outline" size={22} color="white" />
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.blue} /></View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={conversations.length ? styles.conversationList : styles.center}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={42} color={colors.blue} /></View>
              <Text style={styles.emptyTitle}>Aún no hay conversaciones</Text>
              <Text style={styles.emptyText}>Inicia un chat con otro trabajador de VITEG.</Text>
              <Pressable onPress={() => setPeopleOpen(true)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Nuevo mensaje</Text></Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const worker = otherWorker(item);
            const name = workerName(worker);
            return (
              <Pressable onPress={() => setSelected(item)} style={styles.conversation}>
                <Avatar name={name} photoUrl={worker?.photoUrl} size={52} />
                <View style={styles.conversationBody}>
                  <View style={styles.conversationTop}>
                    <Text numberOfLines={1} style={styles.conversationName}>{name}</Text>
                    <Text style={[styles.conversationTime, Boolean(item.unreadCount) && styles.unreadColor]}>{shortTime(item.lastMessage?.createdAt ?? item.lastMessageAt)}</Text>
                  </View>
                  <View style={styles.conversationBottom}>
                    <Text numberOfLines={1} style={[styles.conversationPreview, Boolean(item.unreadCount) && styles.unreadPreview]}>{previewText(item.lastMessage)}</Text>
                    {!!item.unreadCount && <Text style={styles.unreadBadge}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={peopleOpen} animationType="slide" onRequestClose={() => setPeopleOpen(false)}>
        <View style={styles.peopleRoot}>
          <View style={styles.peopleHeader}>
            <Pressable onPress={() => setPeopleOpen(false)} style={styles.iconButton}><Ionicons name="close" size={25} color={colors.ink} /></Pressable>
            <View><Text style={styles.peopleTitle}>Nuevo chat</Text><Text style={styles.peopleCount}>{workers.length} trabajadores disponibles</Text></View>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Buscar trabajador" placeholderTextColor="#829AB1" style={styles.searchInput} />
          </View>
          <FlatList
            data={filteredWorkers}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.peopleList}
            ListEmptyComponent={<Text style={styles.noResults}>No se encontraron trabajadores.</Text>}
            renderItem={({ item }) => {
              const name = workerName(item);
              return (
                <Pressable onPress={() => void openWorker(item)} style={styles.workerRow}>
                  <Avatar name={name} photoUrl={item.photoUrl} size={48} />
                  <View style={{ flex: 1 }}><Text style={styles.workerName}>{name}</Text><Text style={styles.workerRole}>{item.role === "ADMIN" ? "Administrador" : "Repartidor"}</Text></View>
                  <Ionicons name="chatbubble-outline" size={21} color={colors.blue} />
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
});

function Avatar({ name, photoUrl, size }: { name: string; photoUrl?: string; size: number }) {
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={styles.avatarText}>{initials(name)}</Text></View>;
}

function MessageBubble({ message, mine, onOpenImage }: { message: Message; mine: boolean; onOpenImage: (url: string) => void }) {
  const attachment = message.attachments?.[0];
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        {attachment?.kind === "IMAGE" && (
          <Pressable onPress={() => onOpenImage(attachment.url)}>
            <Image source={{ uri: attachment.url }} resizeMode="cover" style={styles.messageImage} />
          </Pressable>
        )}
        {attachment?.kind === "VIDEO" && (
          <Pressable onPress={() => void Linking.openURL(attachment.url)} style={styles.videoCard}>
            <View style={styles.playCircle}><Ionicons name="play" size={26} color="white" /></View>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.videoTitle}>Video</Text><Text numberOfLines={1} style={styles.videoMeta}>{attachment.name || "Toca para reproducir"}</Text></View>
          </Pressable>
        )}
        {!!message.text && <Text style={styles.bubbleText}>{message.text}</Text>}
        <View style={styles.bubbleFooter}>
          <Text style={styles.messageTime}>{shortTime(message.createdAt)}</Text>
          {mine && <Ionicons name={(message.readBy?.length ?? 0) > 1 ? "checkmark-done" : "checkmark"} size={15} color={(message.readBy?.length ?? 0) > 1 ? colors.sky : colors.muted} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  chatRoot: { flex: 1, backgroundColor: "#EFEAE2" },
  listHeader: { paddingHorizontal: 18, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.ink, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  newChatButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  conversationList: { paddingHorizontal: 14, paddingVertical: 5 },
  conversation: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontSize: 15, fontWeight: "900" },
  conversationBody: { flex: 1, gap: 5 },
  conversationTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  conversationName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "800" },
  conversationTime: { color: colors.muted, fontSize: 11 },
  unreadColor: { color: colors.green, fontWeight: "800" },
  conversationBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  conversationPreview: { flex: 1, color: colors.muted, fontSize: 13 },
  unreadPreview: { color: colors.ink, fontWeight: "700" },
  unreadBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, overflow: "hidden", backgroundColor: colors.green, color: "white", fontSize: 11, lineHeight: 20, textAlign: "center", fontWeight: "900" },
  empty: { alignItems: "center", maxWidth: 280 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: colors.softBlue, marginBottom: 18 },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 6 },
  emptyButton: { marginTop: 18, backgroundColor: colors.blue, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  emptyButtonText: { color: "white", fontWeight: "800" },
  chatHeader: { minHeight: 62, backgroundColor: "white", paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  chatHeaderText: { flex: 1 },
  chatName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  chatRole: { color: colors.muted, fontSize: 11, marginTop: 2 },
  messages: { flexGrow: 1, paddingHorizontal: 10, paddingVertical: 12, justifyContent: "flex-end" },
  secureNotice: { alignSelf: "center", maxWidth: 300, marginVertical: 20, padding: 10, borderRadius: 8, backgroundColor: "#FFF5C7", flexDirection: "row", gap: 7 },
  secureText: { flex: 1, color: "#756B43", fontSize: 11, lineHeight: 16, textAlign: "center" },
  bubbleRow: { width: "100%", alignItems: "flex-start", marginVertical: 3 },
  bubbleRowMine: { alignItems: "flex-end" },
  bubble: { maxWidth: "83%", minWidth: 72, padding: 7, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  bubbleMine: { backgroundColor: "#D9FDD3", borderTopRightRadius: 3 },
  bubbleOther: { backgroundColor: "white", borderTopLeftRadius: 3 },
  bubbleText: { color: "#172B4D", fontSize: 14, lineHeight: 20, paddingHorizontal: 3, paddingTop: 2 },
  bubbleFooter: { minHeight: 16, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, marginLeft: 12, marginTop: 2 },
  messageTime: { color: colors.muted, fontSize: 10 },
  messageImage: { width: 220, height: 190, borderRadius: 8, backgroundColor: colors.border },
  videoCard: { width: 230, minHeight: 82, borderRadius: 9, backgroundColor: "#1F2937", padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  playCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  videoTitle: { color: "white", fontSize: 14, fontWeight: "900" },
  videoMeta: { color: "#CBD5E1", fontSize: 11, marginTop: 4 },
  uploading: { minHeight: 32, backgroundColor: "rgba(255,255,255,0.94)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadingText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  composer: { minHeight: 62, backgroundColor: "#F7F9FB", flexDirection: "row", alignItems: "flex-end", gap: 7, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  attachButton: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  messageInput: { flex: 1, maxHeight: 110, minHeight: 43, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 10, borderRadius: 22, backgroundColor: "white", color: colors.ink, fontSize: 14 },
  sendButton: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: "#9FB3C8" },
  peopleRoot: { flex: 1, backgroundColor: "white", paddingTop: Platform.OS === "android" ? 28 : 0 },
  peopleHeader: { minHeight: 68, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  peopleTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  peopleCount: { color: colors.muted, fontSize: 11, marginTop: 2 },
  searchBox: { margin: 14, minHeight: 46, borderRadius: 15, backgroundColor: colors.background, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, minHeight: 46, color: colors.ink },
  peopleList: { paddingHorizontal: 14, paddingBottom: 24 },
  workerRow: { minHeight: 70, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  workerName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  workerRole: { color: colors.muted, fontSize: 12, marginTop: 3 },
  noResults: { color: colors.muted, textAlign: "center", marginTop: 40 },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center" },
  previewClose: { position: "absolute", zIndex: 2, right: 18, top: 40, width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "82%" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  attachmentSheet: { backgroundColor: "white", paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === "android" ? 24 : 34, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  sheetSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 20 },
  attachmentOptions: { flexDirection: "row", gap: 12 },
  attachmentOption: { flex: 1, minHeight: 142, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, backgroundColor: colors.background },
  attachmentIcon: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  attachmentTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  attachmentDescription: { color: colors.muted, fontSize: 11, marginTop: 4 },
  cancelAttachment: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 12 },
  cancelAttachmentText: { color: colors.blue, fontSize: 14, fontWeight: "800" }
});
