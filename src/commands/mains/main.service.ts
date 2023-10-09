import axios, { HttpStatusCode } from "axios";
import { Character, MainAction, MainType } from "./main";
import { Role } from "../../types/role";
import ApiError from "../../errors/api-error.error";

const { API_URL } = process.env;

type ToggleCharacterResponse = {
  character: Character;
  action: MainAction;
  oldType?: MainType;
  newType?: MainType;
};

type ToggleCharacterInput = {
  playerId: string;
  type: MainType;
  characterName: string;
};

export default class MainService {
  /**
   * Assigns a character to a player
   */
  static async toggleCharacter({
    playerId,
    type,
    characterName,
  }: ToggleCharacterInput): Promise<ToggleCharacterResponse> {
    const response = await axios
      .post(`${API_URL}/players/${playerId}/mains`, {
        characterName,
        type,
      })
      .catch((error) => {
        if (!error.response) throw error;
        const { status, data } = error.response;
        if (status === HttpStatusCode.NotFound) {
          this.notFoundHandler(characterName);
        }
        throw new ApiError(status, data.message);
      });

    return response.data;
  }

  private static notFoundHandler(characterName: string) {
    const message = `No se pudo encontrar el personaje con el nombre **${characterName}**.`;
    throw new ApiError(HttpStatusCode.NotFound, message);
  }

  /**
   * Gets the role for a character ID
   */
  static async getRole(guildId: string, characterId: number): Promise<Role> {
    const params = new URLSearchParams({
      guildId,
      characterId: characterId.toString(),
    });

    const response = await axios.get(`${API_URL}/roles?${params.toString()}`);

    return response.data;
  }
}
