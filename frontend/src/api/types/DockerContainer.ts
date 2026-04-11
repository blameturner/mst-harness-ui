export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}
